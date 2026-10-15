const normalizeRoomName = (name: string) => name.trim().toLowerCase();

/** Filler words guests type around a room name in cancel/book chat. */
const ROOM_NAME_STOP_WORDS = new Set([
  "a",
  "again",
  "all",
  "an",
  "and",
  "another",
  "any",
  "at",
  "book",
  "booking",
  "bookings",
  "can",
  "cancel",
  "cancelled",
  "cancellation",
  "change",
  "checkout",
  "checkin",
  "check",
  "could",
  "date",
  "dates",
  "day",
  "days",
  "extend",
  "for",
  "gimme",
  "gona",
  "gonna",
  "got",
  "gotta",
  "guest",
  "guests",
  "hello",
  "hey",
  "hi",
  "i",
  "id",
  "im",
  "in",
  "is",
  "it",
  "just",
  "kindly",
  "lemme",
  "like",
  "ll",
  "may",
  "me",
  "might",
  "modify",
  "more",
  "my",
  "need",
  "needed",
  "needs",
  "night",
  "nights",
  "now",
  "number",
  "of",
  "on",
  "one",
  "ones",
  "or",
  "out",
  "plaese",
  "please",
  "plz",
  "pls",
  "reservation",
  "reservations",
  "room",
  "rooms",
  "shorten",
  "some",
  "stay",
  "still",
  "the",
  "their",
  "them",
  "these",
  "this",
  "that",
  "those",
  "to",
  "update",
  "wan",
  "wanna",
  "want",
  "wanted",
  "wants",
  "would",
]);

const tokenize = (value: string) =>
  normalizeRoomName(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => Boolean(token) && !/^\d+$/.test(token));

/**
 * Strip cancel/booking filler from a free-text room mention.
 * "cancel The Meridian room booking" → "meridian"
 * "Orchid Twin Loft" → "orchid twin loft"
 *
 * When every token is filler (e.g. "cancel one of my bookings"), the guest
 * named no room at all — return "" rather than falling back to the raw
 * sentence, which would otherwise become a bogus room-name filter that
 * matches no real room and hides every active booking.
 */
export const extractRoomNameQuery = (raw: string) => {
  const tokens = tokenize(raw);
  const kept = tokens.filter((token) => !ROOM_NAME_STOP_WORDS.has(token));

  return kept.join(" ");
};
