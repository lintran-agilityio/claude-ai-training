"use client";

import { BookingToolsProvider } from "./booking-tools";
import { RoomToolsProvider } from "./room-tools";
import { GlobalToolRendererProvider } from "./global-tool-renderer-provider";

export * from "./booking-tools";
export * from "./room-tools";
export * from "./global-tool-renderer-provider";

/**
 * Mounts every generative-UI tool renderer for the homestay agent:
 * `useRenderTool` / `useHumanInTheLoop` for rooms + bookings, then the wildcard
 * `useDefaultRenderTool` fallback last so named renderers resolve first.
 */
export const DeclarativeUiToolProviders = () => {
  return (
    <>
      <RoomToolsProvider />
      <BookingToolsProvider />
      <GlobalToolRendererProvider />
    </>
  );
};
