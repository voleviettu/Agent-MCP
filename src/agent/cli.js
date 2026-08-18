import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig } from "./config.js";
import { connectMcpServers } from "./mcp-clients.js";
import { runAgentTurn } from "./run.js";
import { loadSkills } from "./skills.js";

const config = await loadConfig(process.argv[2] ?? "config.json");
const skills = await loadSkills(config.rootDir, config.skillDirs);
const mcp = await connectMcpServers(config.mcpServers, config.rootDir);
const terminal = createInterface({ input, output });
let history = [];

console.log(`Connected ${Object.keys(config.mcpServers).length} MCP servers and loaded ${skills.size} skill(s).`);
console.log("Type a request, or 'exit'.");

try {
  while (true) {
    const prompt = (await terminal.question("\nYou> ")).trim();
    if (!prompt) continue;
    if (["exit", "quit"].includes(prompt.toLowerCase())) break;

    try {
      const result = await runAgentTurn({ prompt, config, skills, mcp, history });
      history = result.messages;
      console.log(`\nAgent> ${result.text}`);
    } catch (error) {
      console.error(`Agent error: ${error.message}`);
    }
  }
} finally {
  terminal.close();
  await mcp.close();
}

