/**
 * Service ↔ required equipment helpers.
 *
 * The mapping itself now lives in the `service_equipment_requirements` DB
 * table — admin-editable from /admin/equipment-inventory. Consumers should
 * read it via the `useServiceEquipmentRequirements` hook
 * (`src/hooks/useServiceEquipmentRequirements.ts`).
 *
 * This file keeps the static constants + analytics helper that don't depend
 * on the mapping itself.
 */

/**
 * Buffer (in days) added BEFORE and AFTER any equipment rental window when
 * computing service-blocked dates. Gives staff time to receive returns and
 * prep gear for the next session, and prevents same-day handoff stress.
 */
export const EQUIPMENT_TURNAROUND_BUFFER_DAYS = 1;

/** Log a hardware-conflict block event for analytics (#6). Best-effort; never throws. */
export const logEquipmentBlockEvent = async (params: {
  // The Supabase client — typed loosely on purpose so this util doesn't need
  // to import the generated Database types.
  supabase: any;
  equipmentName: string;
  service: string;
  blockDirection: "service_blocked_by_rental" | "rental_blocked_by_service";
  blockedDate?: string | null;
  userEmail?: string | null;
}) => {
  try {
    await params.supabase.from("equipment_block_events").insert({
      equipment_name: params.equipmentName,
      service: params.service,
      block_direction: params.blockDirection,
      blocked_date: params.blockedDate ?? null,
      user_email: params.userEmail ?? null,
    });
  } catch {
    // analytics is fire-and-forget
  }
};
