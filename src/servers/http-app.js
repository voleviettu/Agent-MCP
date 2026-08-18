import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createTodoServer } from "../todo/server.js";

function unauthorized(res) {
  return res.status(401).set("WWW-Authenticate", "Bearer").json({ error: "unauthorized" });
}

export function createHttpApp({ key, filePath = "data/todos-http.json" }) {
  if (!key) throw new Error("MCP_KEY is required");

  const app = createMcpExpressApp();

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/mcp", (req, res, next) => {
    const header = req.headers.authorization ?? "";
    if (header !== `Bearer ${key}`) return unauthorized(res);
    next();
  });

  app.post("/mcp", async (req, res) => {
    const server = createTodoServer({ name: "todo-http", filePath });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("HTTP MCP request failed", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.all("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  });

  return app;
}

