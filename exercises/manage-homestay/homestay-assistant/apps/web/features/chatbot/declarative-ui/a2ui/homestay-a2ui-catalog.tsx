import { createCatalog, type RendererProps } from "@copilotkit/a2ui-renderer";

import {
  ROOM_COMPARISON_CATALOG_ID,
  ROOM_COMPARISON_COMPONENT,
  roomComparisonPropsSchema,
  type RoomComparisonProps,
} from "@repo/schemas";
import { cn } from "@repo/utils";
import { ChatAgentAvatar } from "@/features/chatbot/components/ChatAvatars";
import { EmbeddedWidget } from "@/features/chatbot/components/EmbeddedWidget";
import { RoomImage } from "@/features/room/components/RoomImage";

/**
 * Highlights rendered per card. Capped so a room with five facts does not make
 * its card taller than a room with one — the grid rows are already locked to a
 * single height (`auto-rows-fr`) and the list reserves its own min-height.
 */
const HIGHLIGHT_LIMIT = 4;

/** Non-breaking space — holds the row height when an optional line is absent. */
const PLACEHOLDER = " ";

/**
 * Copy for the empty state — shown if the surface binds before its rooms
 * resolve. Keeps the card chrome intact instead of collapsing to a
 * zero-height grid.
 */
const EMPTY_STATE_MESSAGE =
  "Share the dates or the stays you're weighing and I'll line them up side by side here.";

/**
 * Renders the room comparison the agent's `compare_rooms` tool builds in code
 * from the guest's latest room search — the same rooms as the Room List cards
 * above it, which is why each card reuses `RoomImage` (image + level badge +
 * capacity) from those cards.
 *
 * Chrome matches the in-chat Room List: an assistant avatar next to a framed
 * card at the shared chat zoom (gold rule + serif heading), mirroring the
 * `data-chat-message-row="assistant"` row `ChatAssistantMessage` wraps a
 * tool-only turn in. Every card is `flex h-full flex-col` inside an
 * `auto-rows-fr` grid and every line (name, rate, highlights, availability)
 * reserves a fixed slot, so the layout never shifts with a room's detail.
 *
 * Props are destructured with defaults so a partial payload renders the
 * header + empty state rather than throwing on `rooms.map`.
 */
const RoomComparison = ({ props }: RendererProps<RoomComparisonProps>) => {
  const { eyebrow = "", note = "", rooms = [], title = "" } = props;
  const hasRooms = rooms.length > 0;

  return (
    <div
      data-chat-message-row="assistant"
      className="flex items-start justify-start gap-3 px-3 pt-3"
    >
      <ChatAgentAvatar />
      <div className="min-w-0 flex-1">
        <EmbeddedWidget unframed className="max-w-[min(100%,420px)]">
          <section className="max-w-full space-y-3 rounded-xl border border-border bg-card p-3.5 text-card-foreground">
            <header className="space-y-1.5">
              {eyebrow ? (
                <p className="text-[10px] font-semibold tracking-[0.14em] text-gold uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 shrink-0 rounded-full bg-gold" />
                <h3 className="font-serif text-lg leading-tight font-medium text-foreground">
                  {title}
                </h3>
              </div>
              {note ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {note}
                </p>
              ) : null}
            </header>

            {hasRooms ? (
              <div
                className={cn(
                  "grid auto-rows-fr gap-2.5",
                  rooms.length === 1 ? "grid-cols-1" : "grid-cols-2",
                )}
              >
                {rooms.map((room, index) => {
                  const {
                    id = "",
                    name = "",
                    level = 0,
                    levelColor = "",
                    capacity = 0,
                    imageUrl = "",
                    nightlyRate = "",
                    availability = "",
                    highlights = [],
                  } = room;
                  const visibleHighlights = highlights.slice(0, HIGHLIGHT_LIMIT);

                  return (
                    <article
                      key={id || `room-${index}`}
                      className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background/60"
                    >
                      <RoomImage
                        compact
                        imageUrl={imageUrl}
                        name={name}
                        level={level}
                        levelColor={levelColor}
                        capacity={capacity}
                      />

                      <div className="flex flex-1 flex-col p-2.5">
                        <h4 className="line-clamp-1 font-serif text-sm leading-tight font-medium text-foreground">
                          {name || PLACEHOLDER}
                        </h4>

                        <p className="mt-1.5 min-h-5">
                          {nightlyRate ? (
                            <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                              {nightlyRate}
                            </span>
                          ) : (
                            PLACEHOLDER
                          )}
                        </p>

                        <ul className="mt-2 min-h-[4.75rem] space-y-1 text-xs text-muted-foreground">
                          {visibleHighlights.map((highlight) => (
                            <li key={highlight} className="flex gap-1.5">
                              <span
                                aria-hidden
                                className="mt-1.5 size-1 shrink-0 rounded-full bg-gold"
                              />
                              <span className="line-clamp-1">{highlight}</span>
                            </li>
                          ))}
                        </ul>

                        <p className="mt-auto min-h-4 border-t border-border pt-2 text-[11px] font-medium text-primary">
                          {availability || PLACEHOLDER}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/60 px-4 py-8 text-center">
                <span
                  aria-hidden
                  className="h-1 w-8 shrink-0 rounded-full bg-gold/40"
                />
                <p className="font-serif text-sm leading-tight font-medium text-foreground">
                  No rooms to compare yet
                </p>
                <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                  {EMPTY_STATE_MESSAGE}
                </p>
              </div>
            )}
          </section>
        </EmbeddedWidget>
      </div>
    </div>
  );
};

/**
 * A2UI catalog for the room comparison. The surface is emitted only by the
 * agent's `compare_rooms` tool (a fixed-schema envelope built from verified
 * room data — no LLM designs it), so a custom-only catalog with this single
 * root component is enough. Informational only: no booking controls.
 */
export const homestayA2UICatalog = createCatalog(
  {
    [ROOM_COMPARISON_COMPONENT]: {
      description:
        "Side-by-side comparison of up to four rooms from the guest's latest room search. Rendered by the compare_rooms tool from verified room data; informational only — never used to confirm or create a booking.",
      props: roomComparisonPropsSchema,
    },
  },
  {
    [ROOM_COMPARISON_COMPONENT]: RoomComparison,
  },
  { catalogId: ROOM_COMPARISON_CATALOG_ID },
);
