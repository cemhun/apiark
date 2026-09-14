import { create } from "zustand";
import type { EnvironmentData } from "@apiark/types";
import {
  loadEnvironments as loadEnvironmentsApi,
  getResolvedVariables as getResolvedVariablesApi,
  loadRootDotenv,
  loadGlobals as loadGlobalsApi,
  saveGlobals as saveGlobalsApi,
  getCollectionDefaults,
  updateCollectionDefaults,
} from "@/lib/tauri-api";

interface EnvironmentState {
  environments: EnvironmentData[];
  activeEnvironmentName: string | null;
  activeCollectionPath: string | null;
  /** Runtime variable overrides from scripts (not persisted to disk) */
  runtimeOverrides: Record<string, string>;
  /** `ark.globals` store - script-writable, persisted to `.apiark/globals.local.yaml` */
  globals: Record<string, string>;
  /**
   * `ark.collectionVariables` store - shared, committed variables from the
   * collection's Collection Defaults, persisted to `.apiark/apiark.yaml`.
   * Lowest-priority layer when resolving `{{variable}}` values.
   */
  collectionVariables: Record<string, string>;

  loadEnvironments: (collectionPath: string) => Promise<void>;
  setActiveEnvironment: (name: string | null) => void;
  setActiveCollectionPath: (path: string | null) => void;
  getResolvedVariables: () => Promise<Record<string, string>>;
  applyMutations: (mutations: Record<string, string | null>) => void;
  applyGlobalMutations: (mutations: Record<string, string | null>) => void;
  /** Reload collection variables from disk (e.g. after editing them in Collection Defaults). */
  reloadCollectionVariables: (collectionPath: string) => Promise<void>;
  /** Apply `ark.collectionVariables.set()/.unset()` mutations from a script run and persist them. */
  applyCollectionVariableMutations: (mutations: Record<string, string | null>) => void;
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: [],
  activeEnvironmentName: null,
  activeCollectionPath: null,
  runtimeOverrides: {},
  globals: {},
  collectionVariables: {},

  loadEnvironments: async (collectionPath) => {
    try {
      const envs = await loadEnvironmentsApi(collectionPath);
      const { activeEnvironmentName } = get();
      // Re-validate the currently selected environment against the freshly
      // loaded list. If it no longer exists (e.g. it belonged to a different
      // collection, or was deleted/renamed), fall back to the first
      // available environment (or none) - otherwise getResolvedVariables()
      // would fail with "Environment '<name>' not found".
      const stillExists =
        activeEnvironmentName !== null &&
        envs.some((e) => e.name === activeEnvironmentName);
      set({
        environments: envs,
        activeCollectionPath: collectionPath,
        activeEnvironmentName: stillExists
          ? activeEnvironmentName
          : envs.length > 0
            ? envs[0].name
            : null,
      });
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to load environments: ${err}`),
      );
    }
    try {
      const globals = await loadGlobalsApi(collectionPath);
      set({ globals });
    } catch {
      // Not fatal - globals just start empty for this session.
    }
    try {
      const defaults = await getCollectionDefaults(collectionPath);
      set({ collectionVariables: defaults.variables ?? {} });
    } catch {
      // Not fatal - collection variables just start empty for this session.
    }
  },

  setActiveEnvironment: (name) => {
    set({ activeEnvironmentName: name });
  },

  setActiveCollectionPath: (path) => {
    set({ activeCollectionPath: path });
  },

  getResolvedVariables: async () => {
    const { activeCollectionPath, activeEnvironmentName, runtimeOverrides, globals } = get();
    if (!activeCollectionPath) {
      return { ...runtimeOverrides };
    }
    if (!activeEnvironmentName) {
      // No environment selected - still load root .env variables
      // (the Rust side already merges in collection variables at the lowest priority).
      try {
        const rootVars = await loadRootDotenv(activeCollectionPath);
        return { ...globals, ...rootVars, ...runtimeOverrides };
      } catch (err) {
        import("@/stores/toast-store").then(({ useToastStore }) =>
          useToastStore.getState().showWarning("Could not load .env file"),
        );
        return { ...globals, ...runtimeOverrides };
      }
    }
    try {
      // getResolvedVariablesApi already merges: collection variables < root .env
      // < environment variables < secrets (see storage::environment::get_resolved_variables).
      const resolved = await getResolvedVariablesApi(
        activeCollectionPath,
        activeEnvironmentName,
      );
      return { ...globals, ...resolved, ...runtimeOverrides };
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to resolve variables: ${err}`),
      );
      return { ...globals, ...runtimeOverrides };
    }
  },

  applyMutations: (mutations) => {
    set((state) => {
      const overrides = { ...state.runtimeOverrides };
      for (const [key, value] of Object.entries(mutations)) {
        if (value === null) {
          delete overrides[key];
        } else {
          overrides[key] = value;
        }
      }
      return { runtimeOverrides: overrides };
    });
  },

  applyGlobalMutations: (mutations) => {
    if (Object.keys(mutations).length === 0) return;
    const state = get();
    const globals = { ...state.globals };
    for (const [key, value] of Object.entries(mutations)) {
      if (value === null) {
        delete globals[key];
      } else {
        globals[key] = value;
      }
    }
    set({ globals });
    if (state.activeCollectionPath) {
      saveGlobalsApi(state.activeCollectionPath, globals).catch((err) => {
        import("@/stores/toast-store").then(({ useToastStore }) =>
          useToastStore.getState().showError(`Failed to persist globals: ${err}`),
        );
      });
    }
  },

  reloadCollectionVariables: async (collectionPath) => {
    try {
      const defaults = await getCollectionDefaults(collectionPath);
      set({ collectionVariables: defaults.variables ?? {} });
    } catch {
      // Ignore - keep whatever was loaded before.
    }
  },

  applyCollectionVariableMutations: (mutations) => {
    if (Object.keys(mutations).length === 0) return;
    const state = get();
    const collectionVariables = { ...state.collectionVariables };
    for (const [key, value] of Object.entries(mutations)) {
      if (value === null) {
        delete collectionVariables[key];
      } else {
        collectionVariables[key] = value;
      }
    }
    set({ collectionVariables });
    if (state.activeCollectionPath) {
      const path = state.activeCollectionPath;
      getCollectionDefaults(path)
        .then((defaults) =>
          updateCollectionDefaults(path, { ...defaults, variables: collectionVariables }),
        )
        .catch((err) => {
          import("@/stores/toast-store").then(({ useToastStore }) =>
            useToastStore.getState().showError(`Failed to persist collection variables: ${err}`),
          );
        });
    }
  },
}));

