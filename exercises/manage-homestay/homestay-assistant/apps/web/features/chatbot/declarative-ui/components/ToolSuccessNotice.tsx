"use client";

import { useEffect, useRef } from "react";
import { ToolCallStatus } from "@copilotkit/react-core/v2";

import { ConfirmSuccess } from "@/components/confirm-modal";
import { EmbeddedWidget } from "@/features/chatbot/components";
import { Loading } from "@repo/components";
import { parseToolResult } from "@repo/utils";

import type { ToolRendererProps } from "@/features/chatbot/declarative-ui/types";

export type ToolSuccessDisplayResult = {
  id?: string;
  room?: { name?: string };
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  totalPrice?: number;
};

export type ToolSuccessNoticeProps<TResult extends ToolSuccessDisplayResult> =
  ToolRendererProps<TResult> & {
    title: string;
    /** Kept for call-site compatibility; card UI no longer shows a description line. */
    description?: string;
    isSuccess: (result?: TResult | string | null) => boolean;
    onSuccess?: () => void;
  };

export function ToolSuccessNotice<TResult extends ToolSuccessDisplayResult>({
  status,
  result,
  title,
  isSuccess,
  onSuccess,
}: ToolSuccessNoticeProps<TResult>) {
  const sideEffectRan = useRef(false);

  useEffect(() => {
    if (
      status === ToolCallStatus.Complete &&
      isSuccess(result) &&
      !sideEffectRan.current
    ) {
      sideEffectRan.current = true;
      onSuccess?.();
    }
  }, [status, result, isSuccess, onSuccess]);

  if (
    status === ToolCallStatus.Executing ||
    status === ToolCallStatus.InProgress
  ) {
    return (
      <EmbeddedWidget className="px-4 py-6 text-muted-foreground">
        <Loading />
      </EmbeddedWidget>
    );
  }

  if (status === ToolCallStatus.Complete && isSuccess(result)) {
    const parsed = parseToolResult<TResult>(result);

    return (
      <EmbeddedWidget>
        <ConfirmSuccess
          title={title}
          name={parsed?.room?.name}
          checkInDate={parsed?.checkInDate}
          checkOutDate={parsed?.checkOutDate}
          guests={parsed?.guests}
          totalPrice={parsed?.totalPrice}
        />
      </EmbeddedWidget>
    );
  }

  return null;
}
