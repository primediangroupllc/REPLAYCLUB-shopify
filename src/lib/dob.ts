// Date-of-birth pre-gate shared by the signup form (Auth.tsx) and the inline
// account-at-checkout step (Layer 2). Self-reported 18+ filter; Stripe Identity
// is the authoritative age check at booking. Three dropdowns are more
// mobile-reliable than a native date picker.
//
// Extracted from Auth.tsx (was module-private) so both surfaces validate DOB
// identically and there's a single source of truth.

export const DOB_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DOB_YEARS = (() => {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now - 18; y >= now - 100; y--) years.push(y);
  return years;
})();

export const pad2 = (s: string) => s.padStart(2, "0");

export type DobValidation =
  | { ok: true; iso: string }
  | { ok: false; reason: "missing" | "invalid" | "under18" };

// Returns { ok:true, iso } when a real date that is 18+, else { ok:false, reason }.
export function validateDob(year: string, month: string, day: string): DobValidation {
  if (!year || !month || !day) return { ok: false, reason: "missing" };
  const y = Number(year), m = Number(month), d = Number(day);
  const dt = new Date(y, m - 1, d);
  // Reject impossible dates (e.g. Feb 31 rolls over to March).
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return { ok: false, reason: "invalid" };
  }
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  if (dt > cutoff) return { ok: false, reason: "under18" };
  return { ok: true, iso: `${y}-${pad2(month)}-${pad2(day)}` };
}
