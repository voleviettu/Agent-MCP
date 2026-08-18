import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { connectMcpServers } from "../src/agent/mcp-clients.js";
import { runAgentTurn } from "../src/agent/run.js";
import { loadSkills } from "../src/agent/skills.js";
import { createHttpApp } from "../src/servers/http-app.js";

const projectRoot = path.resolve(import.meta.dirname, "..");

function listen(server) {
  server.listen(0, "127.0.0.1");
  return new Promise((resolve) => server.once("listening", resolve));
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test("host merges two servers with prefixes and routes calls to the owner", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcp-homework-host-"));
  const app = createHttpApp({ key: "host-secret", filePath: path.join(directory, "http.json") });
  const listener = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => listener.once("listening", resolve));
  const { port } = listener.address();

  const mcp = await connectMcpServers(
    {
      todo_stdio: {
        transport: "stdio",
        command: process.execPath,
        args: ["src/servers/stdio.js"],
        env: { TODO_FILE: path.join(directory, "stdio.json") },
      },
      todo_http: {
        transport: "http",
        url: `http://127.0.0.1:${port}/mcp`,
        headers: { Authorization: "Bearer host-secret" },
      },
    },
    projectRoot,
  );

  try {
    assert.equal(mcp.tools.length, 6);
    assert(mcp.tools.some((tool) => tool.exposedName === "todo_stdio__add_task"));
    assert(mcp.tools.some((tool) => tool.exposedName === "todo_http__add_task"));

    for (const name of ["todo_stdio__add_task", "todo_http__add_task"]) {
      const tool = mcp.tools.find((candidate) => candidate.exposedName === name);
      const result = await tool.client.callTool({
        name: tool.originalName,
        arguments: { text: `Task from ${tool.serverName}` },
      });
      assert.match(result.content[0].text, /Added #1/);
    }
  } finally {
    await mcp.close();
    await close(listener);
  }
});

test("agent loads a matching skill through use_skill before an MCP tool", async () => {
  const observedRequests = [];
  const responses = [
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "skill-1", type: "function", function: { name: "use_skill", arguments: '{"name":"daily-plan"}' } }],
    },
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "tool-1", type: "function", function: { name: "todo_stdio__list_tasks", arguments: '{"status":"open"}' } }],
    },
    { role: "assistant", content: "**Today**\n- Test the agent\n\n**Later**\n- None\n\n**Blockers**\n- None" },
  ];
  const modelServer = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    observedRequests.push(JSON.parse(body));
    const message = responses.shift();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message }] }));
  });
  await listen(modelServer);
  const { port } = modelServer.address();
  const skills = await loadSkills(projectRoot, ["skills"]);
  const toolCalls = [];
  const mcp = {
    tools: [
      {
        exposedName: "todo_stdio__list_tasks",
        originalName: "list_tasks",
        serverName: "todo_stdio",
        description: "List tasks",
        inputSchema: { type: "object", properties: { status: { type: "string" } } },
        client: {
          async callTool(call) {
            toolCalls.push(call);
            return { content: [{ type: "text", text: "1 ⬜ Test the agent" }] };
          },
        },
      },
    ],
  };

  try {
    const result = await runAgentTurn({
      prompt: "Standup time",
      config: { model: { name: "fake-model", baseUrl: `http://127.0.0.1:${port}/v1` } },
      skills,
      mcp,
    });
    assert.match(result.text, /Today/);
    assert.deepEqual(toolCalls, [{ name: "list_tasks", arguments: { status: "open" } }]);
    assert.match(observedRequests[1].messages.at(-1).content, /# Daily plan/);
  } finally {
    await close(modelServer);
  }
});

