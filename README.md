# MCP Homework — Host, Two Transports, and a Skill

This project satisfies the local parts of the assignment without extra frameworks:

- a CLI agent using Ollama `qwen3.5:4b`;
- an MCP host that loads config, merges tools, and routes calls;
- a stdio todo server with 3 tools, 1 resource, and 1 prompt;
- the same server over authenticated local Streamable HTTP;
- progressive skill loading through `use_skill`;
- persistence, validation, recoverable MCP errors, and integration tests.

Public hosting is intentionally not performed. See [PUBLIC_HTTP.md](PUBLIC_HTTP.md) for the exact deployment steps.

## Requirements

- Node.js 20+
- Ollama
- `qwen3.5:4b`: `ollama pull qwen3.5:4b`

## Install and verify

```bash
npm install
npm test
npm run check
```

## Run everything locally

Use the same local key in both terminals. It is not committed.

Terminal 1 — start the authenticated HTTP server:

```bash
export MCP_KEY="$(openssl rand -hex 32)"
echo "$MCP_KEY"   # copy this value for terminal 2
npm run server:http
```

Terminal 2 — ensure Ollama is running, then start the agent:

```bash
export MCP_KEY="paste-the-same-value"
ollama serve      # omit if Ollama is already running
```

In another terminal, run:

```bash
export MCP_KEY="paste-the-same-value"
npm run agent
```

Try these requests:

```text
Add "finish MCP homework" using the stdio todo server.
Add "record the demo" using the HTTP todo server.
Standup time — what should I work on today?
```

The last request should trigger `use_skill("daily-plan")`, then call both MCP servers and return **Today**, **Later**, and **Blockers**.

## Test with MCP Inspector

Stdio:

```bash
npx @modelcontextprotocol/inspector node src/servers/stdio.js
```

HTTP:

```bash
export MCP_KEY="a-local-test-key"
npm run server:http
npx @modelcontextprotocol/inspector
```

In Inspector, select **Streamable HTTP**, use `http://127.0.0.1:3000/mcp`, and add header `Authorization: Bearer a-local-test-key`. Verify:

1. `add_task`, `list_tasks`, and `complete_task` are listed and callable.
2. `todo://list` can be read.
3. `plan_my_day` can be loaded.
4. Completing an unknown ID returns `isError: true`.

## Project map

```text
config.json                 agent/model/server configuration
skills/daily-plan/SKILL.md on-demand workflow
src/agent/                  MCP host, Ollama loop, and skill loader
src/todo/                   shared todo domain and MCP capabilities
src/servers/stdio.js        stdio entry point
src/servers/http.js         Streamable HTTP entry point
test/                       unit and protocol integration tests
```

## Grading evidence

| Requirement | Evidence |
|---|---|
| Agent host | `src/agent`, `config.json`; merges and routes prefixed tools |
| stdio server | `src/servers/stdio.js`; 3 tools + resource + prompt |
| Local HTTP | `src/servers/http.js`; Streamable HTTP + health + bearer auth |
| Skill in agent | `skills/daily-plan/SKILL.md`; indexed then loaded by `use_skill` |
| Error handling | Zod validation, `isError`, bounded agent loop, stable HTTP errors |
| Tests | `npm test` exercises repository and both MCP transports end to end |

## Demo and submission checklist

For a short YouTube demo:

1. Show `npm test` passing.
2. Show the stdio server in Inspector: tools, resource, and prompt.
3. Show the HTTP server returning 401 without the key, then connecting with it.
4. In the agent, add one task through each server.
5. Ask “Standup time” and show automatic skill loading plus calls to both servers.
6. Briefly open `config.json` and `SKILL.md` and explain the routing.

Submit the YouTube link and source code on Moodle. If you later deploy, also submit the public `/mcp` URL and a temporary grader key.

