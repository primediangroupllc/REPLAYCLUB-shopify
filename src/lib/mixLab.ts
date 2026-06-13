// Mix Lab (experimental mix-intelligence) access — email allowlist.
// UI-gate ONLY; NOT a security boundary (backend functions stay admin-role-gated
// server-side). Single source of truth — expand the allowlist or empty it here.
export const MIX_LAB_EMAILS = ["fumix.mgmt@gmail.com"];

export const isMixLabUser = (email?: string | null): boolean =>
  !!email && MIX_LAB_EMAILS.includes(email.trim().toLowerCase());
