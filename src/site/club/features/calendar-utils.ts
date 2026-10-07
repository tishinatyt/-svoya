import type { Entry } from "@/lib/club-types";
const escapeText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const fold = (line: string) => {
  let out = "",
    part = "",
    bytes = 0;
  for (const c of line) {
    const n = new TextEncoder().encode(c).length;
    if (bytes + n > 74) {
      out += part + "\r\n ";
      part = "";
      bytes = 1;
    }
    part += c;
    bytes += n;
  }
  return out + part;
};
export function eventICS(e: Entry, url: string, now = new Date()) {
  if (!e.starts_at || !Number.isFinite(Date.parse(e.starts_at)))
    throw Error("Missing event date");
  const start = new Date(e.starts_at),
    end = e.ends_at
      ? new Date(e.ends_at)
      : new Date(start.getTime() + 90 * 60000);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SVOYA//Women Club//UK",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${e.id}@svoya.club`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description + "\n" + url)}`,
      `LOCATION:${escapeText([e.city, e.location].filter(Boolean).join(", "))}`,
      `URL:${url}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(e.title)}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
