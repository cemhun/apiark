import type { VariableSuggestion } from "@/lib/variables";

interface VariableSuggestionListProps {
  suggestions: VariableSuggestion[];
  highlightIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (name: string) => void;
  /** Extra classes for positioning (e.g. "top-full left-0 mt-1") */
  className?: string;
}

/** Dropdown list of `{{variable}}` suggestions, shared by all autocomplete inputs. */
export function VariableSuggestionList({
  suggestions,
  highlightIndex,
  onHighlight,
  onSelect,
  className = "top-full left-0 mt-1",
}: VariableSuggestionListProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={`absolute z-50 w-72 max-w-[24rem] overflow-hidden rounded-lg border border-(--color-border) bg-(--color-elevated) shadow-xl ${className}`}
      // Prevent the input from losing focus when clicking a suggestion.
      onMouseDown={(e) => e.preventDefault()}
    >
      <ul className="max-h-56 overflow-y-auto py-1">
        {suggestions.map((s, i) => (
          <li key={s.name}>
            <button
              type="button"
              onMouseEnter={() => onHighlight(i)}
              onClick={() => onSelect(s.name)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                i === highlightIndex
                  ? "bg-(--color-accent)/15 text-(--color-text-primary)"
                  : "text-(--color-text-secondary) hover:bg-(--color-border)/60"
              }`}
            >
              <span className="truncate font-mono">
                {s.kind === "dynamic" ? (
                  <span className="text-(--color-warning)">{s.name}</span>
                ) : (
                  <span className="text-(--color-accent)">{s.name}</span>
                )}
              </span>
              <span className="shrink-0 truncate text-[10px] text-(--color-text-dimmed)">
                {s.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

