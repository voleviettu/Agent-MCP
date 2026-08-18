import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTodoServer } from "../todo/server.js";

const server = createTodoServer({
  name: "todo-stdio",
  filePath: process.env.TODO_FILE ?? "data/todos-stdio.json",
});

await server.connect(new StdioServerTransport());
console.error("todo stdio MCP server ready");

