import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const KEY = "rc:recent-routes";
const MAX = 4;

// Friendly labels for known routes — fallback to the path slug.
const LABELS: Record<string, string> = {
  "/dj-studio": "DJ Studio",
  "/podcast-studio": "Podcast Studio",
  "/livestream-studio": "Livestream Studio",
  "/equipment-rental": "Equipment Rental",
  "/backdrops": "Backdrops",
  "/events": "Events",
  "/gift-cards": "Gift Cards",
  "/profile": "My Profile",
  "/join-roster": "Join Roster",
};

export type RecentRoute = { path: string; label: string; ts: number };

const labelFor = (path: string) =>
  LABELS[path] ||
  path
    .replace(/^\//, "")
    .replace(/[-/]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) ||
  "Home";

const read = (): RecentRoute[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
};

const SKIP = ["/", "/auth", "/reset-password", "/booking-success"];

export const useRecentRoutes = () => {
  const location = useLocation();
  const [recent, setRecent] = useState<RecentRoute[]>(() => read());

  useEffect(() => {
    const path = location.pathname;
    if (SKIP.some((p) => path === p) || path.startsWith("/admin")) return;
    setRecent((prev) => {
      const next = [
        { path, label: labelFor(path), ts: Date.now() },
        ...prev.filter((r) => r.path !== path),
      ].slice(0, MAX);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, [location.pathname]);

  return recent;
};