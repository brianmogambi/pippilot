import { useAuth } from "@/contexts/AuthContext";

/**
 * Phase 3 (improvement plan): true when the user self-identified as a
 * beginner during onboarding. Drives optional UI affordances:
 * longer-form glossary tooltips, conservative-mode defaults on the
 * calculator, etc.
 *
 * Beginner UI is always a layer, not a fork — the same components
 * render for everyone, this hook just decides whether to surface
 * additional help.
 */
export function useBeginnerMode(): boolean {
  const { profile } = useAuth();
  return profile?.experience_level === "beginner";
}
