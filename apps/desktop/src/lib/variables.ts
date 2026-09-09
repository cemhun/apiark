import { useEffect, useState } from "react";
import { useEnvironmentStore } from "@/stores/environment-store";

export interface VariableSuggestion {
  name: string;
  description: string;
  kind: "variable" | "dynamic";
}

/**
 * Built-in dynamic variables resolved at send time.
 * Keep in sync with the Rust interpolation engines:
 *  - apps/cli/src/interpolation.rs
 *  - apps/desktop/src-tauri/src/http/interpolation.rs
 */
export const DYNAMIC_VARIABLES: VariableSuggestion[] = [
  { name: "$uuid", description: "Random UUID v4", kind: "dynamic" },
  { name: "$timestamp", description: "Unix timestamp (seconds)", kind: "dynamic" },
  { name: "$timestampMs", description: "Unix timestamp (milliseconds)", kind: "dynamic" },
  { name: "$isoTimestamp", description: "ISO 8601 timestamp", kind: "dynamic" },
  { name: "$randomInt", description: "Random integer 0-1000", kind: "dynamic" },
  { name: "$randomFloat", description: "Random float 0-1", kind: "dynamic" },
  { name: "$randomNumber", description: "Random 8-digit number", kind: "dynamic" },
  { name: "$randomString", description: "Random 16-char alphanumeric", kind: "dynamic" },
  { name: "$randomEmail", description: "Random email address", kind: "dynamic" },
];

/**
 * Returns the list of variable suggestions for `{{ }}` autocomplete:
 * resolved user/environment variables first, then built-in dynamic variables.
 * Automatically refreshes when the active environment/collection changes.
 */
export function useVariableSuggestions(): VariableSuggestion[] {
  const activeCollectionPath = useEnvironmentStore((s) => s.activeCollectionPath);
  const activeEnvironmentName = useEnvironmentStore((s) => s.activeEnvironmentName);
  const environments = useEnvironmentStore((s) => s.environments);
  const runtimeOverrides = useEnvironmentStore((s) => s.runtimeOverrides);
  const [userVariables, setUserVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    useEnvironmentStore
      .getState()
      .getResolvedVariables()
      .then((vars) => {
        if (!cancelled) setUserVariables(vars);
      })
      .catch(() => {
        if (!cancelled) setUserVariables({});
      });
    return () => {
      cancelled = true;
    };
  }, [activeCollectionPath, activeEnvironmentName, environments, runtimeOverrides]);

  const userSuggestions: VariableSuggestion[] = Object.entries(userVariables).map(
    ([name, value]) => ({
      name,
      description: value ? `= ${value}` : "environment variable",
      kind: "variable" as const,
    }),
  );

  return [...userSuggestions, ...DYNAMIC_VARIABLES];
}

/**
 * Non-hook variant for consumers outside React (e.g. Monaco completion
 * providers) that need the current suggestion list on demand.
 */
export async function getAllVariableSuggestions(): Promise<VariableSuggestion[]> {
  let userVars: Record<string, string> = {};
  try {
    userVars = await useEnvironmentStore.getState().getResolvedVariables();
  } catch {
    // Ignore — fall back to dynamic-only suggestions.
  }
  const userSuggestions: VariableSuggestion[] = Object.entries(userVars).map(
    ([name, value]) => ({
      name,
      description: value ? `= ${value}` : "environment variable",
      kind: "variable" as const,
    }),
  );
  return [...userSuggestions, ...DYNAMIC_VARIABLES];
}

/** Filter suggestions by a case-insensitive substring match on the name. */
export function filterVariableSuggestions(
  suggestions: VariableSuggestion[],
  query: string,
): VariableSuggestion[] {
  if (!query) return suggestions;
  const q = query.toLowerCase();
  return suggestions.filter((s) => s.name.toLowerCase().includes(q));
}

