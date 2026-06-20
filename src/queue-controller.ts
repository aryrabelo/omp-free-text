/**
 * Queue controller for the free-text prompt queue (OMP-coupled).
 *
 * The note IS the queue (lines read top-to-bottom; each task line carries its
 * state as a checkbox marker):
 * - the queue-step key sends the next `- [ ]` task (marking it `- [>]`), or deletes a `---` barrier.
 * - the toggle-auto key toggles auto-run (primes immediately when already idle).
 * - on each `session_stop` the in-flight `- [>]` task is marked done (`- [x]`); in
 *   auto-run the next task is then fed, until the queue drains or hits a `---` barrier.
 *
 * Pure queue parsing lives in `./queue`; this module owns the OMP wiring.
 */
import type {
	ExtensionAPI,
	ExtensionContext,
	SessionStopEvent,
} from "@oh-my-pi/pi-coding-agent";
import type { KeyId } from "@oh-my-pi/pi-tui";
import type { ShortcutConfig } from "./config";
import { humanizeKey } from "./config";
import {
	completeInflight,
	findHead,
	markInflight,
	removeBarrier,
} from "./queue";

/**
 * Whether a settling turn ended badly, so auto-run must halt instead of feeding
 * the next prompt into a broken session. `last_assistant_message` is an
 * `AgentMessage` union; only its assistant variant carries `stopReason`.
 */
function turnFailed(event: SessionStopEvent): boolean {
	const last = event.last_assistant_message;
	return (
		!!last &&
		"stopReason" in last &&
		(last.stopReason === "error" || last.stopReason === "aborted")
	);
}

/** Best-effort herdr HITL ping (no-op outside herdr); a missing/older herdr must never break the session. */
async function pingHerdr(pi: ExtensionAPI, label: string): Promise<void> {
	if (process.env.HERDR_ENV !== "1") return;
	try {
		await pi.exec("herdr", [
			"notification",
			"show",
			"Queue paused - your turn",
			"--body",
			label,
			"--sound",
			"request",
		]);
	} catch {
		// Best-effort: a missing/older herdr must never break the session.
	}
}

/** Dependencies the queue controller needs from the extension factory. */
export interface QueueDeps {
	pi: ExtensionAPI;
	/** Current note text. */
	content: () => string;
	/** Persist a new note body (debounced save + history + widget refresh). */
	persist: (ctx: ExtensionContext, next: string) => Promise<void>;
	/** Re-render the widget (its hint reflects auto-mode). */
	refresh: (ctx: ExtensionContext) => void;
	/** `repo/branch` label for the herdr HITL ping. */
	label: () => string;
	/** Whether the notes editor is open — auto-run pauses so a save can't clobber task state. */
	editorOpen: () => boolean;
	/** Resolved, possibly user-overridden shortcut keys. */
	shortcuts: ShortcutConfig;
}

/** Public surface of the queue controller used by the factory. */
export interface QueueController {
	isAuto: () => boolean;
	isBlocked: () => boolean;
	reset: () => void;
}

/** Wire the note-as-prompt-queue and return its control surface. */
export function createQueue(deps: QueueDeps): QueueController {
	const { pi } = deps;
	let auto = false;
	// `blocked` drives the widget hint's unlock instruction and, inside herdr, mirrors
	// into the sidebar via a strictly-paired `herdr:blocked` event (one true <-> one false).
	let blocked = false;
	function setBlocked(active: boolean, label?: string): void {
		if (active === blocked) return;
		blocked = active;
		if (process.env.HERDR_ENV !== "1") return;
		try {
			pi.events.emit(
				"herdr:blocked",
				active ? { active: true, label } : { active: false },
			);
		} catch {
			// Best-effort: the herdr integration may be absent or older.
		}
	}

	async function sendPrompt(
		ctx: ExtensionContext,
		line: number,
		text: string,
		deliverAs?: "followUp",
	): Promise<void> {
		// Send as a real user message so the dispatched prompt shows in the transcript exactly
		// as if the user typed it. From idle (manual step / priming) a plain send starts the turn;
		// from inside session_stop (auto-advance) "followUp" queues it for the post-settle drain
		// (a plain send would throw AgentBusyError while the settling turn is still streaming).
		// Any dispatch resumes the queue — clear a prior human-in-the-loop pause.
		setBlocked(false);
		pi.sendUserMessage(text, deliverAs ? { deliverAs } : undefined);
		await deps.persist(ctx, markInflight(deps.content(), line));
	}

	async function haltAtBarrier(ctx: ExtensionContext): Promise<void> {
		auto = false;
		setBlocked(true, deps.label());
		deps.refresh(ctx);
		ctx.ui.notify(
			`Queue paused at --- (human in the loop) — ${humanizeKey(deps.shortcuts.queueStep)} to pass`,
			"info",
		);
		await pingHerdr(pi, deps.label());
	}

	/** Feed the next line while the agent is idle (prompt -> send, barrier -> halt). */
	async function feedIdle(ctx: ExtensionContext): Promise<void> {
		const head = findHead(deps.content());
		if (head.kind === "prompt") await sendPrompt(ctx, head.line, head.text);
		else if (head.kind === "barrier") await haltAtBarrier(ctx);
	}

	async function step(ctx: ExtensionContext): Promise<void> {
		if (auto) {
			ctx.ui.notify(
				"Auto-run is on — toggle it off (Ctrl+shift+down) to step manually",
				"info",
			);
			return;
		}
		// A manual queue-step is the human engaging — clear any pause state.
		setBlocked(false);
		const head = findHead(deps.content());
		if (head.kind === "empty") {
			ctx.ui.notify("Note queue is empty", "info");
			return;
		}
		if (head.kind === "barrier") {
			await deps.persist(ctx, removeBarrier(deps.content(), head.line));
			ctx.ui.notify("Passed --- barrier", "info");
			return;
		}
		await sendPrompt(ctx, head.line, head.text);
	}

	async function toggle(ctx: ExtensionContext): Promise<void> {
		auto = !auto;
		deps.refresh(ctx);
		ctx.ui.notify(auto ? "Queue auto-run ON" : "Queue auto-run OFF", "info");
		// Prime: session_stop won't fire while the agent is already idle.
		if (auto && ctx.isIdle()) await feedIdle(ctx);
	}

	/** In auto-run, advance after a settle: halt on failure/barrier, else feed one task. */
	async function autoAdvance(
		event: SessionStopEvent,
		ctx: ExtensionContext,
	): Promise<void> {
		if (turnFailed(event)) {
			auto = false;
			deps.refresh(ctx);
			return;
		}
		if (deps.editorOpen()) return;
		const head = findHead(deps.content());
		if (head.kind === "empty") return;
		if (head.kind === "barrier") {
			await haltAtBarrier(ctx);
			return;
		}
		// Feed the next line as a follow-up user message (visible in the transcript) instead of an
		// invisible additionalContext continuation. After settle the agent auto-drains the follow-up
		// into a fresh turn whose session_stop re-enters here, draining one visible user turn per
		// line with no SESSION_STOP_CONTINUATION_CAP ceiling.
		await sendPrompt(ctx, head.line, head.text, "followUp");
	}

	pi.on("session_stop", async (event, ctx) => {
		// A settled turn means the in-flight task finished — mark it done (manual or auto).
		const completed = completeInflight(deps.content());
		if (completed !== deps.content()) await deps.persist(ctx, completed);
		if (!auto) return;
		await autoAdvance(event, ctx);
	});

	pi.registerShortcut(deps.shortcuts.queueStep as KeyId, {
		description:
			"Queue: send the next note line (delete a --- barrier to pass it)",
		handler: (ctx: ExtensionContext): Promise<void> => step(ctx),
	});
	pi.registerShortcut(deps.shortcuts.queueToggleAuto as KeyId, {
		description: "Queue: toggle auto-run of the note lines",
		handler: (ctx: ExtensionContext): Promise<void> => toggle(ctx),
	});

	return {
		isAuto: (): boolean => auto,
		isBlocked: (): boolean => blocked,
		reset: (): void => {
			auto = false;
			setBlocked(false);
		},
	};
}
