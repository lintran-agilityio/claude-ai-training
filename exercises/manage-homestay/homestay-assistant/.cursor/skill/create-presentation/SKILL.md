---
name: create-presentation
description: >-
  Create slide decks for this project. Use when the user asks for a presentation,
  slide deck, slides, or talk outline about product/tech topics (e.g. CopilotKit,
  AG-UI, Mastra). Always outline slide-by-slide first and wait for approval before
  implementing HTML slides.
---

# Create Presentation

## Workflow

1. **Outline first** — one main message per slide; wait for user approval.
2. **Then implement** — single self-contained HTML file under `docs/presentations/`.
3. Do not start HTML until the slide structure is clear.

## Slide rules

- One main message per slide; concise bullets (max ~4).
- Call out **what you gain** for each major tech on **one** dedicated slide (side-by-side), not one gains slide per tech.
- Architecture slides: only the components in scope (e.g. CopilotKit · AG-UI · Mastra). Put feature modules on a **separate** slide or omit them.
- Include architecture / flow diagrams where they teach better than bullets.
- Prefer concrete Homestay tool names when examples help (`check_room_availability`, `confirm_booking`, `create_booking`, `update_room_list`).

## Visual conventions

- Self-contained HTML (no build step); keyboard nav (`←` `→`, `F` fullscreen).
- Fonts: Fraunces (headings) + Source Sans 3 (body).
- Palette: deep teal background; accents teal / gold / blue for the three stack layers — avoid purple-on-white AI defaults.
- CSS variables for colors; consistent card / node styles across slides.
- Progress bar + slide counter in the footer.

## File location

```
docs/presentations/<topic-slug>.html
```

Open in a browser to present.
