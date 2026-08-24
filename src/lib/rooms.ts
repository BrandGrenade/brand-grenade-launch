/**
 * Canonical room naming for the platform.
 *
 * One convention everywhere — marketing site and product UI alike:
 *   "Room NN · Name"  (e.g. "Room 03 · Strategy Pipeline")
 *
 * Room 00 is optional. Anything that labels a room should read its number
 * and name from here rather than hard-coding a variant.
 */

export type RoomKey =
  | "synthesiser"
  | "intelligence"
  | "briefing_room"
  | "pipeline"
  | "creative";

export type RoomDef = {
  key: RoomKey;
  /** Two-digit room number, e.g. "03". */
  num: string;
  /** Canonical room name, e.g. "Strategy Pipeline". */
  name: string;
  /** Anchor id used on the marketing site. */
  anchor: string;
  optional?: boolean;
};

export const ROOM_DEFS: RoomDef[] = [
  {
    key: "synthesiser",
    num: "00",
    name: "Research Synthesiser",
    anchor: "room-00",
    optional: true,
  },
  { key: "intelligence", num: "01", name: "Intelligence Lab", anchor: "room-01" },
  { key: "briefing_room", num: "02", name: "Briefing Room", anchor: "room-02" },
  { key: "pipeline", num: "03", name: "Strategy Pipeline", anchor: "room-03" },
  { key: "creative", num: "04", name: "Creative Engine", anchor: "room-04" },
];

const BY_KEY = Object.fromEntries(ROOM_DEFS.map((r) => [r.key, r])) as Record<
  RoomKey,
  RoomDef
>;

export function room(key: RoomKey): RoomDef {
  return BY_KEY[key];
}

/** "Room 03 · Strategy Pipeline" */
export function roomLabel(key: RoomKey): string {
  const r = BY_KEY[key];
  return `Room ${r.num} · ${r.name}`;
}

/** "Room 03" */
export function roomShort(key: RoomKey): string {
  return `Room ${BY_KEY[key].num}`;
}
