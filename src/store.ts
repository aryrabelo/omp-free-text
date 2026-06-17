/**
 * Persistence for free-text notes: read/write the markdown file and a small
 * debounced saver so rapid updates coalesce into one write.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
