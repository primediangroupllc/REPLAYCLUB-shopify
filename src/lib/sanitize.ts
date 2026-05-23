/**
 * Strips HTML tags from a string to prevent stored XSS.
 * Use on all user-provided text before saving to the database.
 */
export function sanitizeText(input: string): string {
  // Remove HTML tags
  const stripped = input.replace(/<[^>]*>/g, "");
  // Decode common HTML entities that might be used for obfuscation
  return stripped
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    // Re-strip after decoding in case of double-encoded tags
    .replace(/<[^>]*>/g, "");
}

/**
 * Validates that a URL is a safe http/https URL.
 */
export function sanitizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}
