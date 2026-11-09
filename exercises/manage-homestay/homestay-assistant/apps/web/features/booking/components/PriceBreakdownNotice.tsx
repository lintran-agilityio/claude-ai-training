"use client";

import { ToolCallStatus } from "@copilotkit/react-core/v2";

import { Loading } from "@repo/components";
import { formatPrice, formatShortDateForDisplay, parseToolResult } from "@repo/utils";
import { EmbeddedWidget } from "@/features/chatbot/components";
import type { ToolRendererProps } from "@/features/chatbot/declarative-ui/types";

export type PriceBreakdownResult = {
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  nights: number;
  pricePerNight: number;
  roomSubtotal: number;
  extraGuests: number;
  extraGuestSurcharge: number;
  cleaningFee: number;
  taxRate: number;
  tax: number;
  total: number;
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

export const PriceBreakdownNotice = ({
  status,
  result,
  purpose,
}: ToolRendererProps<PriceBreakdownResult> & { purpose?: string }) => {
  // In the booking flow the confirm card already itemises the price — showing
  // both stacked would duplicate the summary.
  if (purpose === "booking") return null;

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

  const p = parseToolResult<PriceBreakdownResult>(result);
  if (status !== ToolCallStatus.Complete || !p?.total) return null;

  const money = (n: number) => formatPrice(n) ?? "";

  return (
    <EmbeddedWidget>
      <div className="w-full space-y-2 p-4" data-testid="price-breakdown">
        <div>
          <p className="font-semibold">{p.roomName}</p>
          <p className="text-xs text-muted-foreground">
            {formatShortDateForDisplay(p.checkInDate)} →{" "}
            {formatShortDateForDisplay(p.checkOutDate)} · {p.nights} night
            {p.nights > 1 ? "s" : ""} · {p.guests} guest{p.guests > 1 ? "s" : ""}
          </p>
        </div>
        <div className="border-t pt-2">
          <Row
            label={`${money(p.pricePerNight)} × ${p.nights} night${p.nights > 1 ? "s" : ""}`}
            value={money(p.roomSubtotal)}
          />
          {p.extraGuests > 0 && (
            <Row
              label={`Extra guest surcharge (${p.extraGuests})`}
              value={money(p.extraGuestSurcharge)}
            />
          )}
          <Row label="Cleaning fee" value={money(p.cleaningFee)} />
          <Row
            label={`Tax (${Math.round(p.taxRate * 100)}%)`}
            value={money(p.tax)}
          />
        </div>
        <div className="flex items-center justify-between border-t pt-2 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{money(p.total)}</span>
        </div>
      </div>
    </EmbeddedWidget>
  );
};
