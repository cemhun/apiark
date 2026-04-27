import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Cookie, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getCookieJar, deleteCookie, clearCookieJar } from "@/lib/tauri-api";
import type { CookieJarEntry } from "@apiark/types";

interface CookieJarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionPath: string;
  collectionName: string;
}

export function CookieJarDialog({
  open,
  onOpenChange,
  collectionPath,
  collectionName,
}: CookieJarDialogProps) {
  const { t } = useTranslation();
  const [cookies, setCookies] = useState<CookieJarEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCookies = async () => {
    setLoading(true);
    try {
      const result = await getCookieJar(collectionPath);
      setCookies(result);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to load cookies: ${err}`),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadCookies();
    }
  }, [open, collectionPath]);

  const handleDelete = async (name: string, domain: string) => {
    try {
      await deleteCookie(collectionPath, name, domain);
      setCookies((prev) => prev.filter((c) => !(c.name === name && c.domain === domain)));
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to delete cookie: ${err}`),
      );
    }
  };

  const handleClearAll = async () => {
    try {
      await clearCookieJar(collectionPath);
      setCookies([]);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to clear cookies: ${err}`),
      );
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[600px] max-h-[80vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xl focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
            <Dialog.Title className="flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
              <Cookie className="h-4 w-4" />
              {t("cookies.title")} — {collectionName}
            </Dialog.Title>
            <div className="flex items-center gap-2">
              {cookies.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
                >
                  {t("cookies.clearAll")}
                </button>
              )}
              <Dialog.Close className="rounded p-1 hover:bg-(--color-elevated)">
                <X className="h-4 w-4 text-(--color-text-muted)" />
              </Dialog.Close>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-auto p-4">
            {loading ? (
              <p className="text-center text-sm text-(--color-text-muted)">{t("common.loading")}</p>
            ) : cookies.length === 0 ? (
              <p className="text-center text-sm text-(--color-text-dimmed)">
                {t("cookies.noCookies")}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-(--color-text-muted)">
                    <th className="pb-2 pr-3">{t("cookies.name")}</th>
                    <th className="pb-2 pr-3">{t("cookies.value")}</th>
                    <th className="pb-2 pr-3">{t("cookies.domain")}</th>
                    <th className="pb-2 pr-3">{t("cookies.path")}</th>
                    <th className="pb-2 pr-3">{t("cookies.flags")}</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.map((cookie, i) => (
                    <tr key={`${cookie.name}-${cookie.domain}-${i}`} className="border-t border-(--color-elevated)">
                      <td className="py-2 pr-3 font-medium text-(--color-text-secondary)">
                        {cookie.name}
                      </td>
                      <td className="py-2 pr-3 max-w-[150px] truncate text-(--color-text-primary)" title={cookie.value}>
                        {cookie.value}
                      </td>
                      <td className="py-2 pr-3 text-(--color-text-muted)">{cookie.domain}</td>
                      <td className="py-2 pr-3 text-(--color-text-muted)">{cookie.path}</td>
                      <td className="py-2 pr-3 text-(--color-text-dimmed)">
                        {[
                          cookie.httpOnly && t("cookies.httpOnly"),
                          cookie.secure && t("cookies.secure"),
                          cookie.sameSite,
                        ].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleDelete(cookie.name, cookie.domain)}
                          className="rounded p-1 text-(--color-text-muted) hover:bg-red-500/10 hover:text-red-400"
                          title={t("cookies.deleteCookie")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
