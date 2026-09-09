import { useRef } from "react";
import { useVariableAutocomplete } from "@/hooks/use-variable-autocomplete";
import { useVariableSuggestions } from "@/lib/variables";
import { VariableSuggestionList } from "@/components/ui/variable-suggestion-list";

interface VariableAutocompleteInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * A drop-in replacement for `<input type="text">` that shows an autocomplete
 * dropdown of environment/dynamic variables whenever the user types `{{`.
 */
export function VariableAutocompleteInput({
  value,
  onChange,
  className,
  ...rest
}: VariableAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = useVariableSuggestions();
  const {
    isOpen,
    filtered,
    highlightIndex,
    setHighlightIndex,
    handleValueChange,
    handleKeyDown,
    select,
  } = useVariableAutocomplete({ value, onChange, suggestions, inputRef });

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleValueChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={(e) => handleKeyDown(e)}
        className={className}
        {...rest}
      />
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

