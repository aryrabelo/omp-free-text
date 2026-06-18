/**
 * Persistence for free-text notes: read/write the markdown file and a small
 * debounced saver so rapid updates coalesce into one write.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Read a note file, returning "" when it does not exist yet. */
export async function loadNote(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}

/** Write a note file, creating parent directories as needed. */
export async function saveNote(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

/**
 * Append a timestamped snapshot of the note to its history log, creating parent
 * directories as needed. Each entry is a `## <ISO timestamp>` heading (with an
 * optional `(label)` suffix, e.g. `discarded`) followed by the note body, so the
 * file is a chronological record of every version — saved or thrown away.
 */
export async function appendHistory(
  path: string,
  content: string,
  at: Date = new Date(),
  label?: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const suffix = label ? ` (${label})` : "";
  await appendFile(path, `## ${at.toISOString()}${suffix}\n\n${content}\n\n`, "utf8");
}

/** A coalescing, flushable writer for note content. */
export interface DebouncedSaver {
  /** Queue `content` to be written after the debounce delay. */
  schedule(content: string): void;
  /** Write any pending content now and wait for all writes to settle. */
  flush(): Promise<void>;
  /** Drop any pending write without flushing. */
  dispose(): void;
}

/**
 * Build a {@link DebouncedSaver} around `save`. Successive `schedule` calls
 * within `delayMs` collapse to a single write of the latest content. Writes are
 * serialized so `flush` resolves only once everything has been persisted.
 */
export function createDebouncedSaver(
  save: (content: string) => Promise<void>,
  delayMs = 400,
): DebouncedSaver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;
  let chain: Promise<void> = Promise.resolve();

  const run = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (pending === undefined) return;
    const content = pending;
    pending = undefined;
    chain = chain.then(() => save(content));
  };

  return {
    schedule(content: string): void {
      pending = content;
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    async flush(): Promise<void> {
      run();
      await chain;
    },
    dispose(): void {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      pending = undefined;
    },
  };
}
