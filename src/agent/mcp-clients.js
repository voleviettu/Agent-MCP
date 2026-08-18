import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function connectMcpServers(servers, rootDir) {
  const connections = [];
  const tools = [];

  try {
    for (const [serverName, definition] of Object.entries(servers)) {
      const client = new Client({ name: `homework-host-${serverName}`, version: "1.0.0" });
      let transport;

      if (definition.transport === "stdio") {
        transport = new StdioClientTransport({
          command: definition.command,
          args: definition.args ?? [],
          cwd: rootDir,
          env: { ...process.env, ...(definition.env ?? {}) },
          stderr: "inherit",
        });
      } else if (definition.transport === "http") {
        transport = new StreamableHTTPClientTransport(new URL(definition.url), {
          requestInit: { headers: definition.headers ?? {} },
        });
      } else {
        throw new Error(`Unsupported transport for ${serverName}: ${definition.transport}`);
      }

      await client.connect(transport);
      const result = await client.listTools();
      const prefix = safeName(serverName);
      for (const tool of result.tools) {
        tools.push({
          exposedName: `${prefix}__${safeName(tool.name)}`,
          originalName: tool.name,
          serverName,
          client,
          description: tool.description ?? `Call ${tool.name} on ${serverName}`,
          inputSchema: tool.inputSchema,
        });
      }
      connections.push({ client, transport, serverName });
    }
  } catch (error) {
    await Promise.allSettled(connections.map(({ client }) => client.close()));
    throw error;
  }

  const names = tools.map((tool) => tool.exposedName);
  if (new Set(names).size !== names.length) throw new Error("MCP tool name collision after prefixing");

  return {
    tools,
    async close() {
      await Promise.allSettled(connections.map(({ client }) => client.close()));
    },
  };
}

