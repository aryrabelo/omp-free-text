import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	utimes,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	appendHistory,
	createDebouncedSaver,
	listNotes,
	loadConfigText,
	loadNote,
	saveNote,
} from "../src/store";

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

describe("appendHistory", () => {
	test("appends timestamped snapshots in chronological order", async () => {
		const path = join(dir, "repo", "branch", "session.history.md");
		await appendHistory(path, "first", new Date("2026-06-18T10:00:00.000Z"));
		await appendHistory(path, "second", new Date("2026-06-18T11:30:00.000Z"));
		const log = await readFile(path, "utf8");
		expect(log).toBe(
			"## 2026-06-18T10:00:00.000Z\n\nfirst\n\n## 2026-06-18T11:30:00.000Z\n\nsecond\n\n",
		);
		expect(log.indexOf("first")).toBeLessThan(log.indexOf("second"));
	});

	test("labels an entry when given a label (e.g. a discarded draft)", async () => {
		const path = join(dir, "h.md");
		await appendHistory(
			path,
			"draft body",
			new Date("2026-06-18T12:00:00.000Z"),
			"discarded",
		);
		expect(await readFile(path, "utf8")).toBe(
			"## 2026-06-18T12:00:00.000Z (discarded)\n\ndraft body\n\n",
		);
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

describe("listNotes", () => {
	test("lists notes newest-first, excludes history logs, extracts a preview", async () => {
		const d = join(dir, "repo", "branch");
		await mkdir(d, { recursive: true });
		await writeFile(join(d, "old.md"), "\n  old note line\nmore\n", "utf8");
		await writeFile(join(d, "new.md"), "new note\n", "utf8");
		await writeFile(join(d, "new.history.md"), "## ts\n\nsnapshot\n", "utf8");
		await utimes(join(d, "old.md"), new Date(1000), new Date(1000));
		await utimes(join(d, "new.md"), new Date(2000), new Date(2000));
		const list = await listNotes(d);
		expect(list.map((n) => n.sessionId)).toEqual(["new", "old"]);
		expect(list.map((n) => n.preview)).toEqual(["new note", "old note line"]);
	});

	test("returns [] when the directory does not exist", async () => {
		expect(await listNotes(join(dir, "nope"))).toEqual([]);
	});
});

describe("loadConfigText", () => {
	test("returns '' when the file does not exist", async () => {
		expect(await loadConfigText(join(dir, "config.json"))).toBe("");
	});

	test("returns written content when the file exists", async () => {
		const p = join(dir, "config.json");
		await writeFile(p, '{"shortcuts":{}}', "utf8");
		expect(await loadConfigText(p)).toBe('{"shortcuts":{}}');
	});
});
