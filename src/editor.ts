/**
 * Pure decision logic for closing the notes editor.
 *
 * No OMP/TUI imports: given the text the editor opened with, the latest buffer,
 * and whether the user submitted (Enter) or cancelled (Esc), decide what to do
 * with the buffer. `main.ts` performs the actual save/confirm side effects.
 */

/** What to do with the editor buffer when the editor closes. */
export type CloseAction = "save" | "discard" | "ask";

/**
 * Decide the close action so an Esc never silently drops unsaved work:
 * - Enter (submit) always saves.
 * - Esc (cancel) with no change discards silently.
 * - Esc (cancel) with unsaved changes asks the user (save or discard).
 */
export function resolveCloseAction(
	original: string,
	next: string,
	submitted: boolean,
): CloseAction {
	if (submitted) return "save";
	return next === original ? "discard" : "ask";
}
