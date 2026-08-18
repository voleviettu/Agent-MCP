import { chat } from "./model.js";
import { skillIndex } from "./skills.js";

const USE_SKILL_TOOL = {
  type: "function",
  function: {
    name: "use_skill",
    description: "Load a skill's complete instructions by exact name. Call this first when a request matches an available skill.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Exact skill name from the available-skills index" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
};

function parseArguments(value) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value || "{}");
  } catch {
    throw new Error("Tool arguments were not valid JSON");
  }
}

function contentToText(result) {
  return (result.content ?? [])
    .map((item) => (item.type === "text" ? item.text : JSON.stringify(item)))
    .join("\n");
}

export async function runAgentTurn({ prompt, config, skills, mcp, history = [] }) {
  const system = [
    "You are a concise coding and productivity agent.",
    "Use tools when they are needed. Never invent tool results.",
    "When a request matches a skill, call use_skill first and follow the returned instructions.",
    "Available skills:",
    skillIndex(skills) || "(none)",
  ].join("\n");

  const modelTools = [
    USE_SKILL_TOOL,
    ...mcp.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.exposedName,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    })),
  ];
  const messages = [{ role: "system", content: system }, ...history, { role: "user", content: prompt }];

  for (let step = 0; step < 12; step += 1) {
    const reply = await chat({
      baseUrl: config.model.baseUrl,
      model: config.model.name,
      messages,
      tools: modelTools,
    });
    messages.push(reply);

    if (!reply.tool_calls?.length) {
      return { text: reply.content || "Done.", messages: messages.slice(1) };
    }

    for (const call of reply.tool_calls) {
      let output;
      try {
        const args = parseArguments(call.function.arguments);
        if (call.function.name === "use_skill") {
          const skill = skills.get(args.name);
          if (!skill) throw new Error(`Unknown skill: ${args.name}`);
          output = skill.markdown;
        } else {
          const tool = mcp.tools.find((candidate) => candidate.exposedName === call.function.name);
          if (!tool) throw new Error(`Unknown tool: ${call.function.name}`);
          const result = await tool.client.callTool({ name: tool.originalName, arguments: args });
          output = contentToText(result);
          if (result.isError) output = `ERROR: ${output}`;
        }
      } catch (error) {
        output = `ERROR: ${error.message}`;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: output });
    }
  }

  throw new Error("Agent stopped after 12 tool-call steps to prevent an infinite loop");
}

