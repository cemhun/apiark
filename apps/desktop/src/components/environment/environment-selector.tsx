import { useEffect, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { useEnvironmentStore } from "@/stores/environment-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export const EnvironmentSelector = forwardRef<HTMLSelectElement>(
  function EnvironmentSelector(_props, ref) {
    const { t } = useTranslation();
    const { environments, activeEnvironmentName, setActiveEnvironment, loadEnvironments } =
      useEnvironmentStore();
    // Prefer the active workspace's declared collection paths over the live
    // collections tree — the tree updates asynchronously as collections open,
    // which previously caused stale loads during workspace switches.
    const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
    const collectionPaths = useWorkspaceStore(
      (s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.collectionPaths,
    );

    useEffect(() => {
      if (collectionPaths && collectionPaths.length > 0) {
        loadEnvironments(collectionPaths[0]);
      }
    }, [activeWorkspaceId, collectionPaths, loadEnvironments]);

    if (environments.length === 0) {
      return (
        <p className="text-xs text-(--color-text-dimmed)">
          {t("environment.noEnvironments")}
        </p>
      );
    }

    return (
      <select
        ref={ref}
        data-tour="environment"
        value={activeEnvironmentName ?? ""}
        onChange={(e) =>
          setActiveEnvironment(e.target.value || null)
        }
        className="w-full rounded bg-(--color-elevated) px-2 py-1.5 text-xs text-(--color-text-primary) outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">{t("environment.noEnvironment")}</option>
        {environments.map((env) => (
          <option key={env.name} value={env.name}>
            {env.name}
          </option>
        ))}
      </select>
    );
  },
);
