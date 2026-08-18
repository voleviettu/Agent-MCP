import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TodoRepository } from "./repository.js";

const asText = (text) => ({ content: [{ type: "text", text }] });

function formatTasks(tasks) {
  if (tasks.length === 0) return "No tasks yet.";
  return tasks.map((task) => `${task.id} ${task.done ? "✅" : "⬜"} ${task.text}`).join("\n");
}

export function createTodoServer({ filePath, name }) {
  const repository = new TodoRepository(filePath);
  const server = new McpServer({ name, version: "1.0.0" });

  server.registerTool(
    "add_task",
    {
      description: "Add one new task. Use when the user asks to remember or create a todo.",
      inputSchema: {
        text: z.string().trim().min(1).max(200).describe("Task text, 1-200 characters"),
      },
    },
    async ({ text }) => {
      const task = await repository.add(text);
      return asText(`Added #${task.id}: ${task.text}`);
    },
  );

  server.registerTool(
    "list_tasks",
    {
      description: "List todo tasks and their completion status. Use for plans and status summaries.",
      inputSchema: {
        status: z.enum(["all", "open", "done"]).default("all"),
        limit: z.number().int().min(1).max(100).default(50),
      },
    },
    async ({ status, limit }) => {
      const tasks = (await repository.list())
        .filter((task) => status === "all" || (status === "done" ? task.done : !task.done))
        .slice(0, limit);
      return asText(formatTasks(tasks));
    },
  );

  server.registerTool(
    "complete_task",
    {
      description: "Mark a todo task complete by numeric ID.",
      inputSchema: {
        id: z.number().int().positive().describe("Task ID returned by list_tasks"),
      },
    },
    async ({ id }) => {
      const task = await repository.complete(id);
      if (!task) {
        return {
          ...asText(`No task #${id}`),
          isError: true,
        };
      }
      return asText(`Completed #${task.id}: ${task.text}`);
    },
  );

  server.registerResource(
    "todo-list",
    "todo://list",
    {
      description: "Current todo list as plain text",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/plain", text: formatTasks(await repository.list()) }],
    }),
  );

  server.registerPrompt(
    "plan_my_day",
    {
      description: "Create a realistic daily plan from open todo tasks",
      argsSchema: {
        hours: z.string().optional().describe("Optional time available, for example '3 hours'"),
      },
    },
    ({ hours }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Read the todo list, focus on open tasks, and propose a realistic plan${hours ? ` for ${hours}` : " for today"}.`,
          },
        },
      ],
    }),
  );

  return server;
}

