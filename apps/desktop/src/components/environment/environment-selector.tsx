import { useEffect, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { useEnvironmentStore } from "@/stores/environment-store";
import { useCollectionStore } from "@/stores/collection-store";

export const EnvironmentSelector = forwardRef<HTMLSelectElement>(
  function EnvironmentSelector(_props, ref) {
    const { t } = useTranslation();
    const { environments, activeEnvironmentName, setActiveEnvironment, loadEnvironments } =
      useEnvironmentStore();
    const { collections } = useCollectionStore();

    // Load environments when collections change
    useEffect(() => {
      if (collections.length > 0) {
        const firstCollection = collections[0];
        if (firstCollection.type === "collection") {
          loadEnvironments(firstCollection.path);
        }
      }
    }, [collections, loadEnvironments]);

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
