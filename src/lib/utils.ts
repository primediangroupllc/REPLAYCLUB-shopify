import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a data: URL (e.g. from canvas.toDataURL()) into a Blob without
 * using fetch(). fetch() of a data: URL is governed by the CSP connect-src
 * directive — when data: isn't allowlisted there, the browser blocks the
 * request with "Failed to fetch". Decoding directly avoids the network
 * layer entirely.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
