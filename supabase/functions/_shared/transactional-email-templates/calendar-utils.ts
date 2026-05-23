/**
 * Builds a Google Calendar "Add Event" URL from booking details.
 * Duration defaults to 1.5 hours for sessions.
 */
export function buildGoogleCalendarUrl(opts: {
  title: string
  date: string        // YYYY-MM-DD
  time: string        // e.g. "2:30 PM"
  durationMinutes?: number
  description?: string
  location?: string
}): string {
  const {
    title,
    date,
    time,
    durationMinutes = 90,
    description = '',
    location = 'Replay Club — pickup details in your confirmation email',
  } = opts

  const datePart = date.replace(/-/g, '')

  const timeMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  let startHour = 14
  let startMin = 0
  if (timeMatch) {
    startHour = parseInt(timeMatch[1], 10)
    startMin = parseInt(timeMatch[2], 10)
    const isPM = timeMatch[3].toUpperCase() === 'PM'
    if (isPM && startHour !== 12) startHour += 12
    if (!isPM && startHour === 12) startHour = 0
  }

  const totalEndMin = startHour * 60 + startMin + durationMinutes
  const endHour = Math.floor(totalEndMin / 60)
  const endMin = totalEndMin % 60

  const pad = (n: number) => n.toString().padStart(2, '0')
  const startISO = `${datePart}T${pad(startHour)}${pad(startMin)}00`
  const endISO = `${datePart}T${pad(endHour)}${pad(endMin)}00`

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`
}
