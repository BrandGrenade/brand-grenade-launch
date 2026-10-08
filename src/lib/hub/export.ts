// Sends an "exported" event to the Partner Hub when a document is downloaded
// or opened for print while this tab was opened from the hub. Fire-and-forget:
// never blocks or fails the download, never attaches the file.
import { readHubContext } from "./context";

type Room = "room-00" | "room-01" | "room-02" | "room-03" | "room-04";

function roomFromPath(path: string): Room {
  if (path.startsWith("/synthesiser")) return "room-00";
  if (path.startsWith("/intelligence")) return "room-01";
  if (path.startsWith("/briefing-room")) return "room-02";
  if (path.startsWith("/creative")) return "room-04";
  return "room-03";
}

function titleOf(input: string): string {
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(input);
  const t = (m ? m[1] : input).replace(/\s+/g, " ").trim();
  return (t || "Document").slice(0, 200);
}

export function noteHubExport(titleOrHtml: string): void {
  if (typeof window === "undefined") return;
  const hub = readHubContext();
  if (!hub) return;
  const title = titleOf(titleOrHtml);
  void import("@/lib/hub.functions")
    .then(({ recordHubExport }) =>
      recordHubExport({ data: { hub, room: roomFromPath(window.location.pathname), title } }),
    )
    .catch(() => {});
}
