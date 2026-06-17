import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDebouncedSaver, loadNote, saveNote } from "../src/store";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "omp-free-text-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadNote / saveNote", () => {
  test("loadNote returns empty string when the file is missing", async () => {
    expect(await loadNote(join(dir, "nope.md"))).toBe("");
  });

  test("saveNote creates parent directories and round-trips content", async () => {
    const path = join(dir, "repo", "branch", "session.md");
    await saveNote(path, "hello\nworld");
    expect(await readFile(path, "utf8")).toBe("hello\nworld");
    expect(await loadNote(path)).toBe("hello\nworld");
  });
});

describe("createDebouncedSaver", () => {
  test("coalesces rapid schedules into a single write of the latest content", async () => {
    const writes: string[] = [];
    const saver = createDebouncedSaver((c) => {
      writes.push(c);
      return Promise.resolve();
    }, 5);
    saver.schedule("a");
    saver.schedule("b");
    saver.schedule("c");
    await saver.flush();
    expect(writes).toEqual(["c"]);
  });

  test("flush persists pending content immediately", async () => {
    const path = join(dir, "note.md");
    const saver = createDebouncedSaver((c) => saveNote(path, c), 10_000);
    saver.schedule("flushed");
    await saver.flush();
    expect(await readFile(path, "utf8")).toBe("flushed");
  });

  test("dispose drops pending content without writing", async () => {
    const writes: string[] = [];
    const saver = createDebouncedSaver((c) => {
      writes.push(c);
      return Promise.resolve();
    }, 5);
    saver.schedule("x");
    saver.dispose();
    await saver.flush();
    expect(writes).toEqual([]);
  });
});
