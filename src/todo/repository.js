import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class TodoRepository {
  #filePath;
  #writeQueue = Promise.resolve();

  constructor(filePath) {
    this.#filePath = path.resolve(filePath);
  }

  async list() {
    return structuredClone(await this.#read());
  }

  async add(text) {
    return this.#mutate((tasks) => {
      const task = {
        id: tasks.reduce((max, item) => Math.max(max, item.id), 0) + 1,
        text,
        done: false,
        createdAt: new Date().toISOString(),
      };
      tasks.push(task);
      return task;
    });
  }

  async complete(id) {
    return this.#mutate((tasks) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return null;
      task.done = true;
      task.completedAt ??= new Date().toISOString();
      return task;
    });
  }

  async #read() {
    try {
      const value = JSON.parse(await readFile(this.#filePath, "utf8"));
      if (!Array.isArray(value)) throw new Error("Todo file must contain an array");
      return value;
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async #mutate(operation) {
    const run = this.#writeQueue.then(async () => {
      const tasks = await this.#read();
      const result = operation(tasks);
      await mkdir(path.dirname(this.#filePath), { recursive: true });
      const temporaryPath = `${this.#filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
      await rename(temporaryPath, this.#filePath);
      return structuredClone(result);
    });
    this.#writeQueue = run.catch(() => undefined);
    return run;
  }
}

