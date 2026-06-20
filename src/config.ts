/**
 * Pure shortcut config parsing for omp-free-text.
 *
 * No imports — this module is stateless pure string/JSON logic.
 * The caller (main.ts, via store.ts) supplies the raw file text.
 */

export interface ShortcutConfig {
	editNotes: string;
	queueStep: string;
	queueToggleAuto: string;
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
	editNotes: "ctrl+n",
	queueStep: "ctrl+down",
	queueToggleAuto: "ctrl+shift+down",
};

export interface ParsedShortcuts {
	shortcuts: ShortcutConfig;
	warnings: string[];
}

// Static membership test — Record<string, true> per project convention (small, fixed keys).
const MODIFIERS: Readonly<Record<string, true>> = {
	ctrl: true,
	shift: true,
	alt: true,
	super: true,
};

const BASE_SPECIAL: Readonly<Record<string, string>> = {
	down: "↓",
	up: "↑",
	left: "←",
	right: "→",
	enter: "Enter",
	space: "Space",
	tab: "Tab",
};

/**
 * Validate and normalize a raw key binding value.
 *
 * ponytail: catches only structural errors (empty segments, non-modifier prefixes);
 * full KeyId validity (e.g. unknown base keys) is delegated to OMP at registration.
 */
function normalizeKey(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	const tokens = raw.trim().toLowerCase().split("+");
	const last = tokens[tokens.length - 1];
	// last is string | undefined (noUncheckedIndexedAccess); !last catches "" and undefined.
	if (
		!last ||
		last in MODIFIERS ||
		!tokens.slice(0, -1).every((p) => p in MODIFIERS)
	) {
		return undefined;
	}
	return tokens.join("+");
}

/** Validate one override entry, mutating shortcuts/warnings in place. */
function applyOverride(
	shortcuts: ShortcutConfig,
	key: keyof ShortcutConfig,
	override: unknown,
	warnings: string[],
): void {
	const normalized = normalizeKey(override);
	if (normalized === undefined) {
		warnings.push(`Invalid shortcut for "${key}": ${JSON.stringify(override)}`);
		return;
	}
	shortcuts[key] = normalized;
}

/** Parse raw config.json text into validated shortcut overrides. Never throws. */
export function parseShortcutConfig(raw: string): ParsedShortcuts {
	const warnings: string[] = [];

	if (raw.trim().length === 0) {
		return { shortcuts: { ...DEFAULT_SHORTCUTS }, warnings };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		return {
			shortcuts: { ...DEFAULT_SHORTCUTS },
			warnings: [`Invalid config.json: ${String(e)}`],
		};
	}

	const shortcuts: ShortcutConfig = { ...DEFAULT_SHORTCUTS };

	if (typeof parsed !== "object" || parsed === null) {
		return { shortcuts, warnings };
	}
	const root = parsed as Record<string, unknown>;
	const sc = root.shortcuts;
	if (typeof sc !== "object" || sc === null) {
		return { shortcuts, warnings };
	}
	const scObj = sc as Record<string, unknown>;

	for (const key of ["editNotes", "queueStep", "queueToggleAuto"] as const) {
		const override = scObj[key];
		if (override !== undefined)
			applyOverride(shortcuts, key, override, warnings);
	}

	return { shortcuts, warnings };
}

/**
 * Format a normalized key string for display in the widget hint label.
 *
 * Examples: "ctrl+n" → "Ctrl+N", "ctrl+shift+down" → "Ctrl+Shift+↓".
 */
export function humanizeKey(key: string): string {
	return key
		.split("+")
		.map((token) => {
			if (token in MODIFIERS)
				return token.charAt(0).toUpperCase() + token.slice(1);
			const special = BASE_SPECIAL[token];
			if (special !== undefined) return special;
			if (token.length === 1) return token.toUpperCase();
			return token.charAt(0).toUpperCase() + token.slice(1);
		})
		.join("+");
}

/**
 * Widget shortcut-hint label: humanizes all three configured keys and marks
 * auto-run with a trailing ▶ when active. When `blocked` (paused at a `---`
 * human-in-the-loop barrier) it appends an explicit unlock instruction naming
 * the queue-step key. Every key is shown so the bindings stay discoverable.
 *
 * Example (defaults, auto off): "(Ctrl+N · Ctrl+↓ queue · Ctrl+Shift+↓ auto)".
 * Example (blocked): "(Ctrl+N · Ctrl+↓ queue · Ctrl+Shift+↓ auto) ⏸ paused — Ctrl+↓ passes ---".
 */
export function queueHint(
	shortcuts: ShortcutConfig,
	auto: boolean,
	blocked = false,
): string {
	const edit = humanizeKey(shortcuts.editNotes);
	const step = humanizeKey(shortcuts.queueStep);
	const toggle = humanizeKey(shortcuts.queueToggleAuto);
	const base = `(${edit} · ${step} queue · ${toggle} auto${auto ? " ▶" : ""})`;
	return blocked ? `${base} ⏸ paused — ${step} passes ---` : base;
}
