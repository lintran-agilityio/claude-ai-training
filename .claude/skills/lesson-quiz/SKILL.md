---
name: lesson-quiz
description: Create a self-test from lesson notes or pasted lesson content, with multiple-choice questions, fill-in-the-blank, scenario questions and flashcards, plus an answer key. Use when the user asks to quiz them, review, test their memory, or prepare for a course quiz or checkpoint.
---

# Lesson quiz

Build a short self-test so the user can check and reinforce what they learned.

## Source
- Use the content the user pastes, or the file they name (for example `notes/YYYY-MM-DD.md`).
- If no source is given, ask which notes to use. Do not quiz from memory or outside knowledge.

## Output language
- Write questions in **English** by default, polite and clear, unless the user asks otherwise.
- Reply in chat in the language the user uses.

## Structure
1. **Multiple choice** (5 questions): 4 options each, one correct answer. Make wrong options plausible, based on commonly confused concepts from the source.
2. **Fill in the blank** (3 questions): key terms, plan names, menu paths.
3. **Scenario questions** (2 questions): "You need to ... Which tool or feature do you use and why?"
4. **Flashcards** (5 to 8): a two-column Markdown table, `Question | Answer`.
5. **Answer key** at the end, with a one-line reason for each answer.

## Optional diagram
When a question is about a choice or a flow, include a small Mermaid `flowchart` in the answer key to show the reasoning. Use fenced `mermaid` blocks, short labels, under 10 nodes.

## Rules
- Test understanding, not trivia. Prefer "when to use X versus Y" over exact wording.
- Every question must be answerable from the source. Do not invent facts.
- Keep the answer key separate (after a `---` rule and a heading) so the user can self-test first.
- Offer to re-quiz only the questions the user got wrong.

## Where to save
- If the user wants a file, write it to `notes/quiz-YYYY-MM-DD.md`.
- Do not commit or push unless the user asks.
