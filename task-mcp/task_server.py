import json

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("task-mcp")

tasks: dict[int, dict] = {}
_next_id = 1


@mcp.tool()
def add_task(title: str) -> dict:
    """Add a new task and return it."""
    global _next_id
    task = {"id": _next_id, "title": title, "done": False}
    tasks[_next_id] = task
    _next_id += 1
    return task


@mcp.tool()
def complete_task(task_id: int) -> dict:
    """Mark a task as done and return it."""
    if task_id not in tasks:
        raise ValueError(f"Task {task_id} not found")
    tasks[task_id]["done"] = True
    return tasks[task_id]


@mcp.resource("tasks://all")
def all_tasks() -> str:
    """All tasks as JSON."""
    return json.dumps(list(tasks.values()), indent=2)


@mcp.resource("tasks://all/{task_id}")
def get_task(task_id: int) -> str:
    """A single task as JSON."""
    if task_id not in tasks:
        raise ValueError(f"Task {task_id} not found")
    return json.dumps(tasks[task_id], indent=2)


@mcp.prompt()
def daily_summary() -> str:
    """Ask the model to summarize today's tasks."""
    lines = [f"- [{'x' if t['done'] else ' '}] #{t['id']} {t['title']}" for t in tasks.values()]
    body = "\n".join(lines) or "(no tasks)"
    return f"Write a short daily summary of my tasks (done vs. pending) and suggest priorities:\n\n{body}"


if __name__ == "__main__":
    mcp.run()
