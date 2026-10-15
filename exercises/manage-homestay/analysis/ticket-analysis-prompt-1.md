# Ticket analysis, prompt 1 (strict: ticket text only, exactly 3 sentences + up to 5 questions)

Prompt used for every ticket:

> Use ONLY the ticket text, do not assume anything not written in the prompt.
> Analyse in exactly 3 numbered sentences: (1) what the ticket asks for, (2) what is ambiguous or missing, (3) the first step I should take.
> Then list up to 5 clarifying questions for the reporter, ordered by which one blocks work the most. Mark any assumption.

Tickets covered: HS-AI-01 to HS-AI-05. Use this file as the baseline to compare against another prompt.

---

## HS-AI-01: Agent service setup and endpoint

1. The ticket asks for a LangGraph agent served through FastAPI and exposed to CopilotKit (as a remote endpoint / AG-UI), with typed state (`messages`, `user_id`, `pending_action`), a checkpointer for conversation state, a `user_id` taken only from the authenticated cookie, a 401 when there is no valid session, and API keys read only from env.
2. The ticket doesn't say what the agent should do (no tools, prompt or purpose beyond "responds"), what `pending_action` holds, which checkpointer or storage to use, how the cookie is validated (HS-BE-01 is named as a dependency, but its contents aren't given), or which LLM provider and CopilotKit version or protocol it should use.
3. The first step is to confirm what HS-BE-01 delivers for cookie authentication, because the 401 check and the cookie-only `user_id` both depend on it, and then write a minimal FastAPI endpoint that rejects unauthenticated requests before any agent logic.

Clarifying questions (most blocking first):
1. What does HS-BE-01 provide for session or cookie validation (name, format, a function to reuse), and is it merged or stubbed yet?
2. Which LLM provider and model should the agent call, and which env var names should hold the keys?
3. What should the agent do in this ticket: a plain chat reply, or tools too? Is `pending_action` only a placeholder in the state, or does it need behavior now?
4. Which checkpointer is expected (in-memory or persistent), and should conversations be scoped per user or per thread?
5. Which CopilotKit integration is required (v2 is mentioned in the prompt, not in the ticket), and which transport should the endpoint use: remote endpoint or AG-UI?

Assumptions: none about the ticket's contents. The CopilotKit v2 mention comes from the prompt, not the ticket.

---

## HS-AI-02: Read-only tools (search_rooms, get_room_details, check_availability)

1. The ticket asks for three read-only agent tools that call the service layer, use Pydantic input schemas and clear docstrings, return structured errors instead of raising exceptions, and return the same result as the REST endpoint for the same query.
2. The ticket doesn't define the tools' parameters or return shapes, the structured error format, which service-layer functions or REST endpoints to call (HS-BE-05 is named as a dependency but its contents aren't given), the valid date format and rules, or how "the agent must relay" a failure message is enforced and tested.
3. The first step is to confirm what HS-BE-05 exposes in the service layer and the REST API for these three queries, then define the Pydantic input schemas and the structured error format before writing any tool code.

Clarifying questions (most blocking first):
1. What does HS-BE-05 provide (service functions, REST endpoints, response schemas) for search, room details and availability?
2. What are the inputs and outputs of each tool (search filters, date format, how a date range is represented, and whether "equals the REST result" means identical JSON)?
3. What is the structured error shape (fields, error codes), and what counts as invalid input besides a bad date?
4. How should "the agent must relay" a service-failure message be enforced: by the system prompt, by the tool's return format, or by a test on agent output?
5. Do the tools depend on the HS-AI-01 agent's state, such as `user_id`, or are they purely public queries?

Assumptions: none.

---

## HS-AI-03: list_my_bookings tool

1. The ticket asks for a `list_my_bookings` agent tool that returns only the logged-in user's bookings through the shared service layer, with no `user_id` parameter exposed to the model.
2. The ticket doesn't say how the tool gets the user's identity if the model can't pass it (HS-AI-01 is named as a dependency, but its contents aren't given), what fields a booking result has, whether there are filters, sorting or pagination, what happens when the user has no bookings or the service fails, or which service function HS-BE-09 provides.
3. The first step is to confirm what HS-BE-09 exposes for listing a user's bookings and how the tool can read the authenticated `user_id` from agent state, then write a failing test that checks one user never sees another user's bookings.

Clarifying questions (most blocking first):
1. What does HS-BE-09 provide (service function name, signature, response schema) for listing bookings?
2. How should the tool receive the authenticated `user_id` without exposing it to the model? Should it read it from the typed agent state defined in HS-AI-01?
3. What should the tool return for each booking (which fields), and should it support filters, such as status or date range, or pagination?
4. What should the tool return when the user has no bookings, when the user isn't authenticated, or when the service fails? Should it use the structured error format from HS-AI-02?
5. Should the result match an existing REST endpoint for the same user, as required in HS-AI-02?

Assumptions: none. Questions 4 and 5 only ask whether HS-AI-02 behavior carries over.

---

## HS-AI-04: Write tools (create_booking, update_booking, cancel_booking)

1. The ticket asks for three write tools that call the same services as the REST API and never execute unless the state holds a confirmed `pending_action`, that fail with NotOwner and make no change when the booking belongs to another user, and that return business-rule errors (overlap, capacity) clearly.
2. The ticket doesn't define what a "confirmed" `pending_action` looks like or who confirms it and how (HS-AI-01 is named as a dependency, but its contents aren't given), the tools' parameters and return shapes, which fields update_booking may change, the exact error format, what happens to `pending_action` after a write, or what HS-BE-06..08 provide.
3. The first step is to confirm the `pending_action` structure and confirmation flow from HS-AI-01, and what HS-BE-06..08 expose for create, update and cancel, then write failing tests for the three acceptance criteria (no confirmation, NotOwner, business-rule errors).

Clarifying questions (most blocking first):
1. What does a confirmed `pending_action` contain (action type, arguments, confirmed flag), and how does the user's confirmation get into state: through CopilotKit's UI or through another graph step?
2. What do HS-BE-06..08 provide (service functions, signatures, errors raised) for create, update and cancel, and which of them raises NotOwner?
3. What are the inputs of each tool, and which fields can update_booking change?
4. What is the structured error format for NotOwner and business-rule errors, and is it the same as in HS-AI-02?
5. Should the tool check that its arguments match the confirmed `pending_action`, and what happens to `pending_action` after a write succeeds or fails?

Assumptions: none. CopilotKit's UI is mentioned in question 1 only as an open option.

---

## HS-AI-05: Graph with human-in-the-loop confirmation

1. The ticket asks for a graph with the flow understand intent → choose tool → (for write) build summary → `interrupt` → execute or abort → respond, where missing information triggers a follow-up question, a complete request pauses with a summary (room, dates, guests, price), approval runs the action once, rejection writes nothing, a changed request rebuilds the summary, and a page refresh restores the pending confirmation from the checkpointer.
2. The ticket doesn't say how the user approves or rejects (UI element or typed reply), which fields are required before a summary can be built beyond the room, dates and guests in the example, how the price is obtained, how a changed request during confirmation is detected, whether the flow covers update and cancel as well as create, or how "runs once" is guaranteed (HS-AI-04 is named as a dependency, but its contents aren't given).
3. The first step is to confirm the `pending_action` shape and the write-tool contract from HS-AI-04, then sketch the graph's nodes, edges and state and write a failing test for the pause-and-approve path before building the other branches.

Clarifying questions (most blocking first):
1. How does the user give approval or rejection (a CopilotKit UI component or a typed message), and what payload resumes the `interrupt`?
2. Which write actions go through this flow (create only, or also update and cancel), and what is the required-field list for each before a summary can be built?
3. Where does the price in the summary come from (an existing tool or service, or computed in the graph)?
4. How should a "changed request" during confirmation be recognized, for example from any new user message while paused, and should the old pending action be discarded or replaced?
5. How should "runs once" be guaranteed, for example against a duplicate resume or a retry after failure, and what does the agent say after approval, rejection or an error?

Assumptions: none. Question 2 asks whether update and cancel are in scope. They are not assumed to be.

---

## Notes for comparison

- Format held to: exactly 3 numbered sentences, then at most 5 questions, ordered by how much they block work.
- Common blocker across all five tickets: each depends on another ticket (HS-BE-xx or HS-AI-xx) whose contents are not given, so the first question is usually "what does the dependency provide".
- Add the second prompt's output below this line to compare.
