export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
}

function fmt(d: Date): string {
  if (Number.isNaN(d.getTime())) return ""; // guard: never throw on an invalid Date — degrade the link instead
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmt(e.start)}/${fmt(e.end)}`,
    details: e.description ?? "",
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcs(e: CalendarEvent): string {
  const uid = `${Date.now()}@replayclub.io`;
  const escape = (s: string) => s.replace(/[\n,;]/g, (m) => ({ "\n": "\\n", ",": "\\,", ";": "\\;" }[m]!));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Replay Club//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.start)}`,
    `DTEND:${fmt(e.end)}`,
    `SUMMARY:${escape(e.title)}`,
    e.description ? `DESCRIPTION:${escape(e.description)}` : "",
    e.location ? `LOCATION:${escape(e.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export function downloadIcs(e: CalendarEvent, filename = "replay-club-session.ics") {
  const blob = new Blob([buildIcs(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}