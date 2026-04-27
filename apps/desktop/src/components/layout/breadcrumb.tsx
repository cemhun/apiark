import { ChevronRight, FolderOpen } from "lucide-react";
import { useActiveTab } from "@/stores/tab-store";
import { useMemo } from "react";

export function Breadcrumb() {
  const tab = useActiveTab();

  const segments = useMemo(() => {
    if (!tab?.filePath || !tab?.collectionPath) return null;

    const relative = tab.filePath
      .replace(tab.collectionPath, "")
      .replace(/^[\\/]/, "")
      .replace(/\.yaml$/, "");

    const parts = relative.split(/[\\/]/);
    if (parts.length === 0) return null;

    const collectionName = tab.collectionPath.split(/[\\/]/).pop() ?? "Collection";

    return [collectionName, ...parts];
  }, [tab?.filePath, tab?.collectionPath]);

  if (!segments || segments.length === 0) return null;

  return (
    <div className="flex items-center gap-1 border-b border-(--color-border) bg-(--color-surface) px-4 py-1.5">
      <FolderOpen className="mr-0.5 h-3 w-3 shrink-0 text-(--color-accent)" />
      {segments.map((segment, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-(--color-border)" />}
          <span
            className={`text-xs ${
              i === 0
                ? "font-semibold text-(--color-accent)"
                : i === segments.length - 1
                ? "font-medium text-(--color-text-primary)"
                : "text-(--color-text-muted)"
            }`}
          >
            {segment}
          </span>
        </span>
      ))}
    </div>
  );
}
