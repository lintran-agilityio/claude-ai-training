# task-mcp

Small task manager MCP server built with the MCP Python SDK v1 (FastMCP). Tasks are kept in memory.

## Features
- Tools: `add_task(title)`, `complete_task(task_id)`
- Resources: `tasks://all`, `tasks://all/{task_id}`
- Prompt: `daily_summary`

## Run
```bash
uv run mcp dev task_server.py   # MCP Inspector
```

## Add to Claude Code
```bash
claude mcp add task-mcp -- uv --directory <path>/task-mcp run task_server.py
```
