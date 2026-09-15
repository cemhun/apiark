import { useRef, useState } from "react";
import { useVariableAutocomplete } from "@/hooks/use-variable-autocomplete";
import {
  useVariableSuggestions,
  useResolvedVariables,
  splitTextSegments,
} from "@/lib/variables";
import { VariableSuggestionList } from "@/components/ui/variable-suggestion-list";

interface VariableAutocompleteInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /**
   * Whether to render the colored `{{variable}}` overlay at all. Defaults to
   * true. Pass `false` for masked (`type="password"`) fields while hidden —
   * otherwise the overlay's plain-text rendering would defeat the masking.
   */
  showHighlight?: boolean;
}

/**
 * A drop-in replacement for `<input type="text">` that shows an autocomplete
 * dropdown of environment/dynamic variables whenever the user types `{{`,
 * and — once the input is blurred — highlights any `{{variable}}`
 * references it contains: accent color if the variable resolves to a
 * value (shown on hover), warning color if it's undefined.
 */
export function VariableAutocompleteInput({
  value,
  onChange,
  className,
  onFocus,
  onBlur,
  showHighlight = true,
  ...rest
}: VariableAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const suggestions = useVariableSuggestions();
  const resolvedVars = useResolvedVariables();
  const {
    isOpen,
    filtered,
    highlightIndex,
    setHighlightIndex,
    handleValueChange,
    handleKeyDown,
    select,
  } = useVariableAutocomplete({ value, onChange, suggestions, inputRef });

  const segments = splitTextSegments(value);
  const hasVariables = segments.some((s) => s.type === "var");
  const showOverlay = showHighlight && hasVariables && !focused;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleValueChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={(e) => handleKeyDown(e)}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={`${className ?? ""} ${showOverlay ? "text-transparent caret-(--color-text-primary)" : ""}`}
        {...rest}
      />
      {showOverlay && (
        <div
          className={`${className ?? ""} pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap`}
          aria-hidden="true"
        >
          {segments.map((seg, i) =>
            seg.type === "text" ? (
              <span key={i} className="text-(--color-text-primary)">
                {seg.value}
              </span>
            ) : (
              <span
                key={i}
                className={`pointer-events-auto cursor-default ${
                  resolvedVars[seg.value] === undefined
                    ? "text-(--color-warning)"
                    : "text-(--color-accent)"
                }`}
                title={
                  resolvedVars[seg.value] === undefined
                    ? `${seg.value} is not defined`
                    : `${seg.value} = ${resolvedVars[seg.value]}`
                }
              >
                {`{{${seg.value}}}`}
              </span>
            ),
          )}
        </div>
      )}
      {isOpen && (
        <VariableSuggestionList
          suggestions={filtered}
          highlightIndex={highlightIndex}
          onHighlight={setHighlightIndex}
          onSelect={select}
        />
      )}
    </div>
  );
}
