import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHttpApp } from "../src/servers/http-app.js";

const projectRoot = path.resolve(import.meta.dirname, "..");

async function exerciseServer(client) {
  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    ["add_task", "complete_task", "list_tasks"],
  );

  const added = await client.callTool({ name: "add_task", arguments: { text: "Pass MCP integration test" } });
  assert.match(added.content[0].text, /Added #1/);

  const listed = await client.callTool({ name: "list_tasks", arguments: { status: "open" } });
  assert.match(listed.content[0].text, /Pass MCP integration test/);

  const missing = await client.callTool({ name: "complete_task", arguments: { id: 999 } });
  assert.equal(missing.isError, true);

  const resources = await client.listResources();
  assert.equal(resources.resources[0].uri, "todo://list");
  const resource = await client.readResource({ uri: "todo://list" });
  assert.match(resource.contents[0].text, /Pass MCP integration test/);

  const prompts = await client.listPrompts();
  assert.equal(prompts.prompts[0].name, "plan_my_day");
  const prompt = await client.getPrompt({ name: "plan_my_day", arguments: { hours: "2 hours" } });
  assert.match(prompt.messages[0].content.text, /2 hours/);
}

test("stdio server exposes tools, resource, prompt, and recoverable errors", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcp-homework-stdio-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["src/servers/stdio.js"],
    cwd: projectRoot,
    env: { ...process.env, TODO_FILE: path.join(directory, "todos.json") },
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-test", version: "1.0.0" });

  await client.connect(transport);
  try {
    await exerciseServer(client);
  } finally {
    await client.close();
  }
});

test("HTTP server requires a key and passes the same MCP contract", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcp-homework-http-"));
  const app = createHttpApp({ key: "integration-secret", filePath: path.join(directory, "todos.json") });
  const listener = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => listener.once("listening", resolve));
  const address = listener.address();
  const url = `http://127.0.0.1:${address.port}/mcp`;

  const unauthorized = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  });
  assert.equal(unauthorized.status, 401);

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: "Bearer integration-secret" } },
  });
  const client = new Client({ name: "http-test", version: "1.0.0" });

  try {
    await client.connect(transport);
    await exerciseServer(client);
  } finally {
    await client.close();
    await new Promise((resolve, reject) => listener.close((error) => (error ? reject(error) : resolve())));
  }
});

