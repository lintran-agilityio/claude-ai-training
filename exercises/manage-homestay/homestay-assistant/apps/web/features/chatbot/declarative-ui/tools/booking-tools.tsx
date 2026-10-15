"use client";

import { z } from "zod";
import { useHumanInTheLoop, useRenderTool } from "@copilotkit/react-core/v2";

import { AGENT_KEYS, TOOL_KEYS } from "@repo/constants";
import {
  cancelBookingInputSchema,
  createBookingInputSchema,
  updateBookingInputSchema,
  getBookingsInputSchema,
  cancelBookingByRoomSchema,
  modifyBookingByRoomSchema,
  confirmBookingSchema,
  confirmModifyBookingSchema,
  editModifyBookingSchema,
  type CancelBookingByRoomArgs,
  type ModifyBookingByRoomArgs,
  type ConfirmBookingArgs,
  type EditModifyBookingArgs,
} from "@repo/schemas";
import { MODEL_NAME } from "@repo/types";
import {
  CancelBookingByRoomModal,
  ModifyBookingByRoomModal,
  CancelBookingNotice,
  FindBookingByIdNotice,
  UpdateBookingNotice,
  CreateBookingNotice,
  ConfirmBookingModal,
  EditModifyBookingModal,
  MyBookingsNotice,
  ConfirmModifyModal,
} from "@/features/booking/components";
import {
  CancelBookingToolProps,
  CreateBookingToolProps,
  UpdateBookingToolProps,
  GetBookingsResult,
  FindBookingByIdResult,
} from "@/features/booking/types";
import { HitlConfirmStayModal } from "@/features/booking/components/HitlConfirmStayModal";

/**
 * Render-only params for the `find_booking_by_id` notice — the agent owns the
 * authoritative LLM-facing input schema. `useRenderTool` requires a schema; the
 * notice only reads the tool `result`.
 */
const findBookingByIdRenderParams = z.object({
  bookingId: z.string().optional(),
  purpose: z.enum(["cancel", "modify"]).optional(),
  requestedCheckInDate: z.string().optional(),
  requestedCheckOutDate: z.string().optional(),
  requestedCheckOutDeltaDays: z.number().int().optional(),
  requestedGuests: z.number().optional(),
});

export const BookingToolsProvider = () => {
  useHumanInTheLoop(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.ACTION.CONFIRM_BOOKING,
      description:
        "Required immediately for a NEW booking: the platform forces this right after find_room(book_resolve) resolves one room whose availability probe was free (full-info path), and you call it directly after a [book-stay] submit (the Booking Form already checked availability). There is no check_room_availability tool. Args: { roomId, checkInDate, checkOutDate, guests } — from the find_room result's availability block or the [book-stay] message; the modal hydrates the room details on the frontend. Pair this UI with exactly one short sentence in the guest's language asking them to review; never repeat modal fields. Wait for the response: confirmed=true requires create_booking with the returned fields — the same HITL card then shows submitting/success/failed (a server-side conflict on dates just taken shows failed). On success, its one companion sentence may name the booked room exactly once but must not repeat any other card field; confirmed=false stops the booking flow, calls no more tools, and gets a brief 'booking stopped' reply. Never use this for modifying a booking.",
      parameters: confirmBookingSchema,
      render: ({ status, args, respond, result, toolCallId }) => (
        <ConfirmBookingModal
          status={status}
          args={args as Partial<ConfirmBookingArgs>}
          respond={respond}
          result={result}
          toolCallId={toolCallId}
        />
      ),
    },
    [],
  );

  useHumanInTheLoop(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
      description:
        "Edit form for MODIFY — the app only routes you here when the guest has not stated a new value (a stated value skips this form entirely). Pass the authoritative bookingId, room, and current dates/guests straight from the find_booking_by_id result you just received. The form checks availability client-side and won't let the guest continue on a taken date. Pair this UI with exactly one short sentence in the guest's language; never repeat form fields. On confirmed:true, the app forces confirm_modify_booking directly with the guest-edited stay — there is no check_room_availability tool. If confirmed:false, keep the booking unchanged.",
      parameters: editModifyBookingSchema,
      render: ({ status, args, respond, result, toolCallId }) => (
        <EditModifyBookingModal
          status={status}
          args={args as Partial<EditModifyBookingArgs>}
          respond={respond}
          result={result}
          toolCallId={toolCallId}
        />
      ),
    },
    [],
  );

  useHumanInTheLoop(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
      description:
        "Show the read-only before→after card. The app forces this after edit_modify_booking confirms (form path) or straight after find_booking_by_id on the stated-change path (that tool already probed availability). Pass { bookingId, room, checkInDate, checkOutDate, guests }: from edit_modify_booking confirmed:true, OR from find_booking_by_id.result.availability (the merged stay it probed); plus originalCheckInDate/originalCheckOutDate/originalGuests from edit_modify_booking args or find_booking_by_id.result.bookings[0] — never reconstruct, merge, or replace any field from UI state or memory. Pair this UI with exactly one short review sentence in the guest's language; never repeat card fields. Wait for explicit confirmation. On confirmed:true, the app forces update_booking with the confirmed fields; its success companion may name the room exactly once but must not repeat any other card field. On confirmed:false, call no mutation and keep the booking unchanged.",
      parameters: confirmModifyBookingSchema,
      render: ({ status, args, respond, result, toolCallId }) => (
        <ConfirmModifyModal
          status={status}
          args={args}
          respond={respond}
          result={result}
          toolCallId={toolCallId}
        />
      ),
    },
    [],
  );

  useHumanInTheLoop(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM,
      description:
        "After find_booking_by_id (or find_bookings, resolved/ambiguous) returns bookings.length > 0, show the cancel confirmation dialog with bookings and queryName from the find result as-is. Pair this UI with exactly one short review sentence in the guest's language; never repeat card fields. Do NOT call cancel_booking until show_cancel_dialog_confirm returns confirmed: true. If confirmed: true, call cancel_booking with bookingId from the result — the same HITL card then shows submitting/success/failed; its success companion may name the room exactly once but must not repeat any other card field. Do NOT call get_bookings, find_bookings, or show_cancellation_success after cancel. If confirmed: false, reply in chat that the booking was kept.",
      parameters: cancelBookingByRoomSchema,
      render: ({ status, args, respond, result, toolCallId }) => (
        <CancelBookingByRoomModal
          status={status}
          args={args as Partial<CancelBookingByRoomArgs>}
          respond={respond}
          result={result}
          toolCallId={toolCallId}
        />
      ),
    },
    [],
  );

  useHumanInTheLoop(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
      description:
        "After find_bookings returns status: \"ambiguous\" for a MODIFY without bookingId, show the selectable list. Pass { bookingIds: [all ids from find_bookings' bookings], queryName } — do NOT send full bookings[] rows (tool args truncate) — PLUS the stated-change fields on this SAME call when the guest's latest message already stated a new value (extract now, not after the pick — the app carries it forward across the pause): requestedCheckInDate/requestedGuests for absolute values, requestedCheckOutDate for an absolute new checkout, or requestedCheckOutDeltaDays for a stated extend/shorten by N nights (never compute a date — the app applies N against the checkout of the booking the guest ultimately selects). The UI hydrates dates/prices from find_bookings. Do NOT pick the first booking. Pair this UI with exactly one short selection sentence in the guest's language; never repeat list fields. When confirmed: true, the app calls find_booking_by_id with bookingId from the result for you, carrying forward any requested fields you set on this call, and routes automatically (edit_modify_booking or stated-change availability). When confirmed: false, reply that bookings were kept unchanged. Never call update_booking from this tool.",
      parameters: modifyBookingByRoomSchema,
      render: ({ status, args, respond, result, toolCallId }) => (
        <ModifyBookingByRoomModal
          status={status}
          args={args as Partial<ModifyBookingByRoomArgs>}
          respond={respond}
          result={result}
          toolCallId={toolCallId}
        />
      ),
    },
    [],
  );

  useRenderTool(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.BOOKING.GET,
      parameters: getBookingsInputSchema,
      render: ({ status, result, parameters, toolCallId }) => (
        <MyBookingsNotice
          status={status}
          result={result as GetBookingsResult | string | null}
          parameters={
            parameters as { purpose?: GetBookingsResult["purpose"] } | undefined
          }
          toolCallId={toolCallId}
        />
      ),
    },
    [],
  );

  useRenderTool(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.BOOKING.FIND_BY_ID,
      parameters: findBookingByIdRenderParams,
      render: ({ status, result, toolCallId }) => (
        <FindBookingByIdNotice
          status={status}
          result={result as FindBookingByIdResult | string | null}
          toolCallId={toolCallId}
        />
      ),
    },
    [],
  );

  useRenderTool(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.BOOKING.CREATE_BOOKING,
      parameters: createBookingInputSchema,
      render: ({ status, result, parameters }) => {
        const props: CreateBookingToolProps = {
          status,
          result: result as CreateBookingToolProps["result"],
          parameters: parameters as CreateBookingToolProps["parameters"],
        };
        return <CreateBookingNotice {...props} />;
      },
    },
    [],
  );

  useRenderTool(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.BOOKING.UPDATE_BOOKING,
      parameters: updateBookingInputSchema,
      render: ({ status, result, parameters }) => {
        const props: UpdateBookingToolProps = {
          status,
          result: result as UpdateBookingToolProps["result"],
          parameters: parameters as UpdateBookingToolProps["parameters"],
        };
        return <UpdateBookingNotice {...props} />;
      },
    },
    [],
  );

  useRenderTool(
    {
      agentId: AGENT_KEYS.HOMESTAY_ASSISTANT,
      name: TOOL_KEYS.BOOKING.CANCEL,
      parameters: cancelBookingInputSchema,
      render: ({ status, result, parameters }) => {
        const props: CancelBookingToolProps = {
          status,
          result: result as CancelBookingToolProps["result"],
          parameters: parameters as CancelBookingToolProps["parameters"],
        };
        return <CancelBookingNotice {...props} />;
      },
    },
    [],
  );

  return null;
};
