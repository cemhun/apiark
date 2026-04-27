import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Plus } from "lucide-react";
import { createSampleCollection } from "@/lib/tauri-api";
import { useSettingsStore } from "@/stores/settings-store";
import { useTabStore } from "@/stores/tab-store";

export function WelcomeScreen({
  onComplete,
  onOpenImport,
}: {
  onComplete: (startTour?: boolean) => void;
  onOpenImport: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { updateSettings } = useSettingsStore();

  const handleStartFresh = async () => {
    setLoading(true);
    try {
      const { useWorkspaceStore } = await import("@/stores/workspace-store");
      const parentDir = useWorkspaceStore.getState().activeWorkspaceDir();
      const path = await createSampleCollection(parentDir);
      await useWorkspaceStore.getState().addCollection(path);
      useTabStore.getState().newTab();
      await updateSettings({ onboardingComplete: true });
      onComplete(true);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to create sample collection: ${err}`),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    await updateSettings({ onboardingComplete: true });
    onComplete();
    onOpenImport();
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-(--color-bg) text-(--color-text-primary)">
      <div className="flex max-w-md flex-col items-center gap-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">{t("onboarding.welcome")}</h1>
          <p className="mt-2 text-sm text-(--color-text-secondary)">
            {t("onboarding.tagline")}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <button
            onClick={handleStartFresh}
            disabled={loading}
            className="flex items-center gap-3 rounded-lg border border-(--color-border) bg-(--color-elevated) px-4 py-3 text-left transition hover:border-blue-500/50 hover:bg-(--color-border)"
          >
            <Plus className="h-5 w-5 shrink-0 text-blue-400" />
            <div>
              <div className="text-sm font-medium">{t("onboarding.startScratch")}</div>
              <div className="text-xs text-(--color-text-dimmed)">
                {t("onboarding.startScratchDesc")}
              </div>
            </div>
          </button>

          <button
            onClick={handleImport}
            className="flex items-center gap-3 rounded-lg border border-(--color-border) bg-(--color-elevated) px-4 py-3 text-left transition hover:border-blue-500/50 hover:bg-(--color-border)"
          >
            <Download className="h-5 w-5 shrink-0 text-green-400" />
            <div>
              <div className="text-sm font-medium">{t("onboarding.importExisting")}</div>
              <div className="text-xs text-(--color-text-dimmed)">
                {t("onboarding.importExistingDesc")}
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={async () => {
            await updateSettings({ onboardingComplete: true });
            onComplete();
          }}
          className="text-xs text-(--color-text-dimmed) hover:text-(--color-text-secondary)"
        >
          {t("common.skipForNow")}
        </button>
      </div>
    </div>
  );
}
