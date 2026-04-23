import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Workspace {
  id: string;
  name: string;
  collectionPaths: string[];
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string;

  activeWorkspace: () => Workspace;
  setActiveWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Workspace;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => void;
  addCollection: (path: string) => Promise<void>;
  removeCollection: (path: string) => void;
}

function defaultWorkspace(): Workspace {
  return { id: "default", name: "Default", collectionPaths: [] };
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [defaultWorkspace()],
      activeWorkspaceId: "default",

      activeWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get();
        return workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
      },

      setActiveWorkspace: async (id: string) => {
        const { workspaces } = get();
        const workspace = workspaces.find((w) => w.id === id);
        if (!workspace) return;

        // Close all current collections
        const { useCollectionStore } = await import("@/stores/collection-store");
        const currentCollections = useCollectionStore.getState().collections
          .filter((c) => c.type === "collection")
          .map((c) => c.path);
        for (const path of currentCollections) {
          useCollectionStore.getState().closeCollection(path);
        }

        // Also close tabs belonging to previous workspace's collections
        const { useTabStore } = await import("@/stores/tab-store");
        const tabs = useTabStore.getState().tabs;
        for (const tab of tabs) {
          if (tab.filePath) {
            useTabStore.getState().closeTab(tab.id);
          }
        }

        set({ activeWorkspaceId: id });

        // Open new workspace's collections
        for (const path of workspace.collectionPaths) {
          useCollectionStore.getState().openCollection(path).catch(() => {});
        }

        // Load environments from first collection
        if (workspace.collectionPaths.length > 0) {
          const { useEnvironmentStore } = await import("@/stores/environment-store");
          useEnvironmentStore.getState().loadEnvironments(workspace.collectionPaths[0]).catch(() => {});
        }
      },

      createWorkspace: (name: string) => {
        const workspace: Workspace = {
          id: `ws-${Date.now()}`,
          name,
          collectionPaths: [],
        };
        set((s) => ({ workspaces: [...s.workspaces, workspace] }));
        return workspace;
      },

      renameWorkspace: (id, name) => {
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
        }));
      },

      deleteWorkspace: (id) => {
        const { workspaces, activeWorkspaceId } = get();
        if (workspaces.length <= 1) return; // Can't delete last workspace
        const newWorkspaces = workspaces.filter((w) => w.id !== id);
        const newActiveId =
          activeWorkspaceId === id ? newWorkspaces[0].id : activeWorkspaceId;
        set({ workspaces: newWorkspaces, activeWorkspaceId: newActiveId });
      },

      addCollection: async (path: string) => {
        const { activeWorkspaceId } = get();
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === activeWorkspaceId && !w.collectionPaths.includes(path)
              ? { ...w, collectionPaths: [...w.collectionPaths, path] }
              : w,
          ),
        }));

        const { useCollectionStore } = await import("@/stores/collection-store");
        await useCollectionStore.getState().openCollection(path);
      },

      removeCollection: (path: string) => {
        const { activeWorkspaceId } = get();
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === activeWorkspaceId
              ? { ...w, collectionPaths: w.collectionPaths.filter((p) => p !== path) }
              : w,
          ),
        }));

        // Close collection and its open tabs
        import("@/stores/collection-store").then(({ useCollectionStore }) => {
          useCollectionStore.getState().closeCollection(path);
        });
        import("@/stores/tab-store").then(({ useTabStore }) => {
          const tabs = useTabStore.getState().tabs;
          for (const tab of tabs) {
            if (tab.collectionPath === path) {
              useTabStore.getState().closeTab(tab.id);
            }
          }
        });
      },
    }),
    {
      name: "apiark-workspaces",
      // One-time migration: seed Default workspace from persisted collections
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const defaultWs = state.workspaces.find((w) => w.id === "default");
        if (defaultWs && defaultWs.collectionPaths.length === 0) {
          // Will be seeded by restoreTabs if persisted collections exist
        }
      },
    },
  ),
);

