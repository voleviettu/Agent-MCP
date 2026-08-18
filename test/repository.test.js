import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { TodoRepository } from "../src/todo/repository.js";

test("repository persists additions and completion", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcp-homework-repository-"));
  const filePath = path.join(directory, "todos.json");
  const repository = new TodoRepository(filePath);

  const first = await repository.add("Build the server");
  const second = await repository.add("Record the demo");
  await repository.complete(first.id);

  assert.equal(second.id, 2);
  assert.deepEqual(
    (await repository.list()).map(({ id, text, done }) => ({ id, text, done })),
    [
      { id: 1, text: "Build the server", done: true },
      { id: 2, text: "Record the demo", done: false },
    ],
  );
  const persisted = await readFile(filePath, "utf8");
  assert.doesNotThrow(() => JSON.parse(persisted));
});

test("repository serializes concurrent writes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcp-homework-concurrency-"));
  const repository = new TodoRepository(path.join(directory, "todos.json"));

  await Promise.all(Array.from({ length: 12 }, (_, index) => repository.add(`Task ${index + 1}`)));
  const tasks = await repository.list();

  assert.equal(tasks.length, 12);
  assert.equal(new Set(tasks.map((task) => task.id)).size, 12);
});
