# Public HTTP deployment instructions

No deployment has been performed. The local HTTP server is already deployment-ready and bearer-protected.

## Simple Render deployment

1. Push this project to a private or public Git repository.
2. In Render, create a **Web Service** from that repository.
3. Configure:
   - Runtime: Node
   - Build command: `npm ci`
   - Start command: `npm run server:http`
   - Health check path: `/health`
4. Add environment variables:
   - `HOST=0.0.0.0`
   - `MCP_KEY=<output of openssl rand -hex 32>`
   - `TODO_FILE=/tmp/todos-http.json`
5. Deploy and verify `https://YOUR-SERVICE.onrender.com/health` returns `{"status":"ok"}`.
6. Test `https://YOUR-SERVICE.onrender.com/mcp` in MCP Inspector with header:
   `Authorization: Bearer <MCP_KEY>`.
7. Replace `todo_http.url` in `config.json` with the HTTPS URL and keep the header as `Bearer ${MCP_KEY}`.

Render's filesystem is ephemeral. That is acceptable for the class demo, but tasks can disappear after a restart. For durable production state, replace the JSON repository with Render Postgres or another managed database.

## Before giving access to the grader

- Generate a dedicated temporary key; do not reuse a personal secret.
- Keep the key only in Render environment variables and send it privately.
- Confirm HTTPS, unauthorized requests return 401, and authenticated Inspector calls pass.
- Do not log the `Authorization` header.
- Rotate or delete the grader key after grading.

