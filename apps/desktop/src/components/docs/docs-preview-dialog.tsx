import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { previewDocs, generateDocs } from "@/lib/tauri-api";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { X, Download, FileText } from "lucide-react";

interface DocsPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionPath: string;
  collectionName: string;
}

export function DocsPreviewDialog({
  open,
  onOpenChange,
  collectionPath,
  collectionName,
}: DocsPreviewDialogProps) {
  const { t } = useTranslation();
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && collectionPath) {
      setLoading(true);
      setError(null);
      previewDocs(collectionPath)
        .then(setHtml)
        .catch((err) => setError(String(err)))
        .finally(() => setLoading(false));
    }
  }, [open, collectionPath]);

  const handleExport = async (format: "html" | "markdown") => {
    try {
      const ext = format === "html" ? "html" : "md";
      const content = await generateDocs(collectionPath, format);
      const filePath = await save({
        defaultPath: `${collectionName}-docs.${ext}`,
        filters: [
          {
            name: format === "html" ? "HTML Files" : "Markdown Files",
            extensions: [ext],
          },
        ],
      });
      if (filePath) {
        await writeTextFile(filePath, content);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[80vh] w-[800px] flex-col overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface)">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
            <FileText className="h-4 w-4" /> {t("docs.title")} — {collectionName}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("html")}
              className="flex items-center gap-1 rounded bg-(--color-elevated) px-2.5 py-1 text-xs text-(--color-text-secondary) hover:bg-(--color-border)"
            >
              <Download className="h-3 w-3" /> {t("docs.html")}
            </button>
            <button
              onClick={() => handleExport("markdown")}
              className="flex items-center gap-1 rounded bg-(--color-elevated) px-2.5 py-1 text-xs text-(--color-text-secondary) hover:bg-(--color-border)"
            >
              <Download className="h-3 w-3" /> {t("docs.markdown")}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="text-(--color-text-muted) hover:text-(--color-text-primary)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-(--color-text-muted)">
              {t("docs.generating")}
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-red-400">
              {error}
            </div>
          ) : (
            <iframe
              srcDoc={html}
              className="h-full w-full border-none"
              sandbox="allow-same-origin"
              title="API Documentation Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
