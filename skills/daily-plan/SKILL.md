---
name: daily-plan
description: Plan the user's day from their todo lists. Use when asked for a daily plan, standup, priorities, or what to work on today.
---
# Daily plan

1. Call `todo_stdio__list_tasks` with `status: "open"`.
2. Call `todo_http__list_tasks` with `status: "open"`.
3. Combine duplicates and prioritize a realistic amount of work.
4. Return exactly three short sections: **Today**, **Later**, and **Blockers**.
5. State which MCP servers supplied the data. Do not invent tasks.

