import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Workspace {
  id: string;
  name: string;
  /** Slug folder name under ~/ApiArk/, e.g. "default" */
  folderName: string;
  collectionPaths: string[];
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string;

  activeWorkspace: () => Workspace;
  /** Returns ~/ApiArk/<folderName> for a workspace */
  workspaceDir: (workspace: Workspace) => Promise<string>;
  /** Returns the active workspace's directory */
  activeWorkspaceDir: () => Promise<string>;
  setActiveWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace>;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => void;
  addCollection: (path: string) => Promise<void>;
  removeCollection: (path: string) => void;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "workspace";
}

function defaultWorkspace(): Workspace {
  return { id: "default", name: "Default", folderName: "default", collectionPaths: [] };
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

      workspaceDir: async (workspace: Workspace) => {
        const { homeDir, join } = await import("@tauri-apps/api/path");
        return join(await homeDir(), "ApiArk", workspace.folderName);
      },

      activeWorkspaceDir: async () => {
        const ws = get().activeWorkspace();
        return get().workspaceDir(ws);
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

      createWorkspace: async (name: string) => {
        const { workspaces } = get();
        // Ensure unique folder name
        let folderName = slugify(name);
        let suffix = 2;
        while (workspaces.some((w) => w.folderName === folderName)) {
          folderName = `${slugify(name)}-${suffix++}`;
        }

        const workspace: Workspace = {
          id: `ws-${Date.now()}`,
          name,
          folderName,
          collectionPaths: [],
        };

        // Create the workspace directory on disk
        try {
          const { homeDir, join } = await import("@tauri-apps/api/path");
          const { mkdir } = await import("@tauri-apps/plugin-fs");
          const dir = await join(await homeDir(), "ApiArk", folderName);
          await mkdir(dir, { recursive: true });
        } catch {
          // Non-fatal — directory may already exist
        }

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
        if (workspaces.length <= 1) return;
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
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Migrate existing workspaces that don't have folderName
        const needs = state.workspaces.some((w) => !w.folderName);
        if (needs) {
          state.workspaces = state.workspaces.map((w) => ({
            ...w,
            folderName: w.folderName ?? slugify(w.name),
          }));
        }
      },
    },
  ),
);

/** Call this once on app startup (after Tauri is ready) to remove collection
 *  paths that no longer exist on disk. */
export async function pruneStaleCollections(): Promise<void> {
  const { exists } = await import("@tauri-apps/plugin-fs");
  const { workspaces } = useWorkspaceStore.getState();

  for (const w of workspaces) {
    const validPaths: string[] = [];
    for (const colPath of w.collectionPaths) {
      const ok = await exists(colPath).catch(() => false);
      if (ok) validPaths.push(colPath);
    }
    if (validPaths.length !== w.collectionPaths.length) {
      useWorkspaceStore.setState((s) => ({
        workspaces: s.workspaces.map((ws) =>
          ws.id === w.id ? { ...ws, collectionPaths: validPaths } : ws,
        ),
      }));
    }
  }
}
