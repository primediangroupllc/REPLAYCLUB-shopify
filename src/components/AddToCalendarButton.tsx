import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar } from "lucide-react";
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendarLinks";

export function AddToCalendarButton({ event, label = "Add to calendar", variant = "outline" as const }: {
  event: CalendarEvent;
  label?: string;
  variant?: "outline" | "default" | "ghost";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2">
          <Calendar className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">Google Calendar</a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadIcs(event)}>
          Apple / Outlook (.ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}