import { createHttpApp } from "./http-app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const app = createHttpApp({ key: process.env.MCP_KEY, host });

app.listen(port, host, () => {
  console.error(`todo HTTP MCP server listening on http://${host}:${port}/mcp`);
});

