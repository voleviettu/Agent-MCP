import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function parseFrontmatter(markdown, filePath) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) throw new Error(`Skill has no YAML frontmatter: ${filePath}`);

  const fields = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-zA-Z][\w-]*):\s*(.+)$/);
    if (field) fields[field[1]] = field[2].trim().replace(/^['"]|['"]$/g, "");
  }
  if (!fields.name || !fields.description) {
    throw new Error(`Skill frontmatter requires name and description: ${filePath}`);
  }
  return { name: fields.name, description: fields.description, filePath, markdown };
}

export async function loadSkills(rootDir, directories = []) {
  const skills = new Map();
  for (const directory of directories) {
    const absoluteDirectory = path.resolve(rootDir, directory);
    let entries;
    try {
      entries = await readdir(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }

    for (const entry of entries.filter((item) => item.isDirectory())) {
      const filePath = path.join(absoluteDirectory, entry.name, "SKILL.md");
      const skill = parseFrontmatter(await readFile(filePath, "utf8"), filePath);
      if (skills.has(skill.name)) throw new Error(`Duplicate skill name: ${skill.name}`);
      skills.set(skill.name, skill);
    }
  }
  return skills;
}

export function skillIndex(skills) {
  return [...skills.values()].map(({ name, description }) => `- ${name}: ${description}`).join("\n");
}

