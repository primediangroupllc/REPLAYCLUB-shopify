import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Home,
  Music,
  Mic,
  Radio,
  Camera,
  Image as ImageIcon,
  Calendar,
  Gift,
  User,
  UserPlus,
  Users,
  Shield,
} from "lucide-react";
import { haptic } from "@/lib/haptics";

type Action = { label: string; to: string; icon: React.ElementType; group: "Book" | "Account" | "Browse" };

const ACTIONS: Action[] = [
  { label: "Book DJ Studio", to: "/dj-studio", icon: Music, group: "Book" },
  { label: "Book Podcast Studio", to: "/podcast-studio", icon: Mic, group: "Book" },
  { label: "Book Livestream Studio", to: "/livestream-studio", icon: Radio, group: "Book" },
  { label: "Book Photoshoot / Backdrops", to: "/backdrops", icon: ImageIcon, group: "Book" },
  { label: "Rent Equipment", to: "/equipment-rental", icon: Camera, group: "Book" },
  { label: "Browse Events", to: "/events", icon: Calendar, group: "Browse" },
  { label: "Buy a Gift Card", to: "/gift-cards", icon: Gift, group: "Browse" },
  { label: "Talent Roster", to: "/?tab=Talent", icon: Users, group: "Browse" },
  { label: "Home", to: "/", icon: Home, group: "Browse" },
  { label: "My Profile", to: "/profile", icon: User, group: "Account" },
  { label: "Join Roster", to: "/join-roster", icon: UserPlus, group: "Account" },
  { label: "Sign In", to: "/auth", icon: Shield, group: "Account" },
];

/**
 * Global ⌘K / Ctrl+K palette. Listens at the window level and is also
 * openable via the menu's "Quick Search" affordance via a custom event
 * (`rc:open-palette`) so we don't have to lift state up to App.
 */
const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("rc:open-palette", onOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("rc:open-palette", onOpen as EventListener);
    };
  }, []);

  const go = (to: string) => {
    haptic(8);
    setOpen(false);
    navigate(to);
  };

  const groups: Action["group"][] = ["Book", "Browse", "Account"];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search studios, events, or actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g} heading={g}>
            {ACTIONS.filter((a) => a.group === g).map((a) => {
              const Icon = a.icon;
              return (
                <CommandItem key={a.to + a.label} onSelect={() => go(a.to)}>
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{a.label}</span>
                  {a.group === "Book" && <CommandShortcut>↵</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;