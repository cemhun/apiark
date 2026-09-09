import { useCallback, useMemo, useState, type RefObject } from "react";
import {
  filterVariableSuggestions,
  type VariableSuggestion,
} from "@/lib/variables";

const MAX_SUGGESTIONS = 20;

interface UseVariableAutocompleteOptions {
  value: string;
  onChange: (value: string) => void;
  suggestions: VariableSuggestion[];
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

/**
 * Detects `{{` triggers while typing in a text input/textarea and provides
 * everything needed to render a suggestion dropdown for `{{variable}}`
 * interpolation: filtered list, keyboard navigation, and insertion logic.
 */
export function useVariableAutocomplete({
  value,
  onChange,
  suggestions,
  inputRef,
}: UseVariableAutocompleteOptions) {
  // Index right after the triggering "{{" (start of the partial variable name), or null if closed.
  const [triggerStart, setTriggerStart] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = useMemo(
    () =>
      triggerStart === null
        ? []
        : filterVariableSuggestions(suggestions, query).slice(0, MAX_SUGGESTIONS),
    [triggerStart, suggestions, query],
  );

  const isOpen = triggerStart !== null && filtered.length > 0;

  const close = useCallback(() => setTriggerStart(null), []);

  /** Re-evaluate whether the caret sits inside an open `{{...}}` trigger. */
  const detectTrigger = useCallback((text: string, caret: number) => {
    const uptoCaret = text.slice(0, caret);
    const openIdx = uptoCaret.lastIndexOf("{{");
    if (openIdx === -1) {
      setTriggerStart(null);
      return;
    }
    const between = uptoCaret.slice(openIdx + 2);
    // If the partial text already contains a closing `}}` or a new `{`,
    // the trigger is no longer "open" at the caret.
    if (between.includes("}}") || between.includes("{") || between.includes("\n")) {
      setTriggerStart(null);
      return;
    }
    setTriggerStart(openIdx + 2);
    setQuery(between);
    setHighlightIndex(0);
  }, []);

  /** Call from the input's onChange handler alongside the raw value + caret position. */
  const handleValueChange = useCallback(
    (newValue: string, caret: number) => {
      onChange(newValue);
      detectTrigger(newValue, caret);
    },
    [onChange, detectTrigger],
  );

  /** Insert the chosen suggestion, replacing the partial `{{query` with `{{name}}`. */
  const select = useCallback(
    (name: string) => {
      if (triggerStart === null) return;
      const el = inputRef.current;
      const caret = el?.selectionStart ?? triggerStart + query.length;
      const before = value.slice(0, triggerStart);
      const after = value.slice(caret);
      const alreadyClosed = after.startsWith("}}");
      const insertText = alreadyClosed ? name : `${name}}}`;
      const newValue = before + insertText + after;
      close();
      onChange(newValue);
      const caretPos = before.length + name.length + (alreadyClosed ? 0 : 2);
      setTimeout(() => {
        el?.focus();
        el?.setSelectionRange(caretPos, caretPos);
      }, 0);
    },
    [triggerStart, query, value, inputRef, onChange, close],
  );

  /** Call from the input's onKeyDown handler. Returns true if the key was consumed. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % filtered.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        select(filtered[highlightIndex].name);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return true;
      }
      return false;
    },
    [isOpen, filtered, highlightIndex, select, close],
  );

  return {
    isOpen,
    filtered,
    highlightIndex,
    setHighlightIndex,
    handleValueChange,
    handleKeyDown,
    select,
    close,
  };
}

