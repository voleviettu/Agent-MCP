import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadSkills, skillIndex } from "../src/agent/skills.js";

test("loads only skill metadata into the startup index", async () => {
  const root = path.resolve(import.meta.dirname, "..");
  const skills = await loadSkills(root, ["skills"]);

  assert.equal(skills.size, 1);
  assert.match(skillIndex(skills), /daily-plan: Plan the user's day/);
  assert.doesNotMatch(skillIndex(skills), /Call `todo_stdio/);
  assert.match(skills.get("daily-plan").markdown, /todo_http__list_tasks/);
});

