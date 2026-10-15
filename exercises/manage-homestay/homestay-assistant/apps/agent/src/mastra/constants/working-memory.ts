/**
 * Soft thread-scoped draft hints for the model.
 *
 * - Template field names ("Workflow state", Intent, Status) are golden LLM wording.
 * - They are NOT Mastra Workflows.
 * - Intent/Status here are soft hints the model may update; do not treat as authority.
 */
export const BOOKING_WORKING_MEMORY_TEMPLATE = `# Workflow state
- Intent: none
- Status: idle
- Current step: none
- Pending confirmation: none
- Last successful tool: none

# Booking draft
- Room:
- Check-in:
- Check-out:
- Guests:
- Notes:
`;
