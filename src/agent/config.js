import { readFile } from "node:fs/promises";
import path from "node:path";

function expandEnvironment(value) {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name) => {
      const replacement = process.env[name];
      if (replacement === undefined) throw new Error(`Missing required environment variable: ${name}`);
      return replacement;
    });
  }
  if (Array.isArray(value)) return value.map(expandEnvironment);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandEnvironment(item)]));
  }
  return value;
}

export async function loadConfig(filePath = "config.json") {
  const absolutePath = path.resolve(filePath);
  const raw = JSON.parse(await readFile(absolutePath, "utf8"));
  const config = expandEnvironment(raw);

  if (!config.model?.name || !config.model?.baseUrl) {
    throw new Error("config.model must contain name and baseUrl");
  }
  if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
    throw new Error("config.mcpServers must contain at least one server");
  }

  return { ...config, rootDir: path.dirname(absolutePath) };
}

