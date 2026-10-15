---
name: lesson-visual-notes
description: Turn pasted lesson or course content into memorable Markdown study notes with Mermaid diagrams, comparison tables, a one-line memory hook and 3 takeaways. Use when the user pastes lesson text and asks to summarize, take notes, or make notes easier to remember.
---

# Lesson visual notes

Turn lesson content into a short, visual, easy-to-remember note. Output is plain Markdown that renders on GitLab, GitHub and VS Code, with diagrams written as Mermaid blocks.

## Output language and tone
- Write the note file in **English**, polite and neutral, unless the user asks for another language.
- Reply to the user in the language they are using in chat.
- Keep only meaningful, necessary knowledge. Drop filler and promotional text.

## Structure (in this order)
1. `## <Lesson title>` with a one-sentence purpose.
2. **Concept map**: a Mermaid `mindmap` with the lesson topic at the root and the key ideas as branches (max 3 levels, short labels).
3. **Key points**: bullet list, one idea per bullet, grouped by the lesson's own sections.
4. **Process or decision diagram** (only when the lesson has steps or a choice): a Mermaid `flowchart`.
5. **Comparison table** (only when two or more easily confused things appear).
6. **Analogy**: one everyday comparison for the hardest concept (for example, "MCP is USB-C for AI").
7. **Apply it as a developer**: 2 to 3 concrete ways to use the lesson in software work.
8. **Memory hook**: exactly one sentence, in a blockquote.
9. **3 takeaways**: exactly three, in the user's voice, one line each.

## Mermaid rules
- Use fenced blocks: ```` ```mermaid ````.
- Prefer `mindmap`, `flowchart LR` or `flowchart TD`. Avoid exotic diagram types that GitLab may not render.
- Keep node labels short (under 6 words). Quote labels that contain punctuation: `A["Step 1: Plan"]`.
- Do not put more than about 12 nodes in one diagram; split instead.
- Only add a diagram when it clarifies something. Never add one for decoration.

## Accuracy
- Use only what the lesson says. Do not invent features, plans or limits. If something is unclear, say so.
- Keep names, plan tiers and menu paths exactly as written in the source.

## Where to save
- If the user asks for a file, write it to `notes/` as `notes/YYYY-MM-DD-<short-topic>.md`.
- For an end-of-day note, merge all lessons of the day into one file `notes/YYYY-MM-DD.md` and add a short "Next steps" list.
- Do not commit or push unless the user asks.
