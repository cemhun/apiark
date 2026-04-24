import { create } from "zustand";

export interface Workspace {
  id: string;
  name: string;
  /** Absolute path to ~/ApiArk/<folderName> */
  dir: string;
  collectionPaths: string[];
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  loaded: boolean;

  activeWorkspace: () => Workspace;
  activeWorkspaceDir: () => string;
  setActiveWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace>;
  renameWorkspace: (id: string, newName: string) => Promise<void>;
  deleteWorkspace: (id: string) => void;
  addCollection: (path: string) => Promise<void>;
  removeCollection: (path: string) => void;
  renameCollectionPath: (oldPath: string, newPath: string) => void;
}


export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  workspaces: [],
  activeWorkspaceId: "",
  loaded: false,

  activeWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  },

  activeWorkspaceDir: () => {
    return get().activeWorkspace()?.dir ?? "";
  },

  setActiveWorkspace: async (id: string) => {
    const { workspaces } = get();
    const workspace = workspaces.find((w) => w.id === id);
    if (!workspace) return;

    const { useCollectionStore } = await import("@/stores/collection-store");
    const currentCollections = useCollectionStore.getState().collections
      .filter((c) => c.type === "collection")
      .map((c) => c.path);
    for (const path of currentCollections) {
      useCollectionStore.getState().closeCollection(path);
    }

    const { useTabStore } = await import("@/stores/tab-store");
    for (const tab of useTabStore.getState().tabs) {
      if (tab.filePath) useTabStore.getState().closeTab(tab.id);
    }

    set({ activeWorkspaceId: id });
    localStorage.setItem("apiark-active-workspace-dir", workspace.dir);

    for (const path of workspace.collectionPaths) {
      useCollectionStore.getState().openCollection(path).catch(() => {});
    }

    if (workspace.collectionPaths.length > 0) {
      const { useEnvironmentStore } = await import("@/stores/environment-store");
      useEnvironmentStore.getState().loadEnvironments(workspace.collectionPaths[0]).catch(() => {});
    }
  },

  createWorkspace: async (name: string) => {
    const { createWorkspaceDir } = await import("@/lib/tauri-api");
    const dir = await createWorkspaceDir(name);

    const workspace: Workspace = { id: dir, name, dir, collectionPaths: [] };
    set((s) => ({ workspaces: [...s.workspaces, workspace] }));
    return workspace;
  },

  deleteWorkspace: (id) => {
    const { workspaces, activeWorkspaceId } = get();
    if (workspaces.length <= 1) return;
    const next = workspaces.filter((w) => w.id !== id);
    const newActiveId = activeWorkspaceId === id ? next[0].id : activeWorkspaceId;
    set({ workspaces: next, activeWorkspaceId: newActiveId });
  },

  renameWorkspace: async (id, newName) => {
    const { workspaces } = get();
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return;

    const { renameWorkspaceDir } = await import("@/lib/tauri-api");
    const newDir = await renameWorkspaceDir(ws.dir, newName);

    // Update all collection paths inside it
    const updatedCollectionPaths = ws.collectionPaths.map((p) =>
      p.startsWith(ws.dir) ? newDir + p.slice(ws.dir.length) : p,
    );

    const updatedWs: Workspace = {
      ...ws,
      id: newDir,
      name: newName,
      dir: newDir,
      collectionPaths: updatedCollectionPaths,
    };

    const newActiveId = get().activeWorkspaceId === id ? newDir : get().activeWorkspaceId;
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? updatedWs : w)),
      activeWorkspaceId: newActiveId,
    }));

    if (newActiveId === newDir) {
      localStorage.setItem("apiark-active-workspace-dir", newDir);
    }

    // Reload collections from their new paths
    const { useCollectionStore } = await import("@/stores/collection-store");
    for (const oldPath of ws.collectionPaths) {
      useCollectionStore.getState().closeCollection(oldPath);
    }
    for (const newPath of updatedCollectionPaths) {
      useCollectionStore.getState().openCollection(newPath).catch(() => {});
    }
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
      for (const tab of useTabStore.getState().tabs) {
        if (tab.collectionPath === path) useTabStore.getState().closeTab(tab.id);
      }
    });
  },

  renameCollectionPath: (oldPath, newPath) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        collectionPaths: w.collectionPaths.map((p) => (p === oldPath ? newPath : p)),
      })),
    }));
  },
}));

/**
 * Scan ~/ApiArk/ on startup.
 * Structure: ~/ApiArk/<workspace>/<collection>/.apiark/apiark.yaml
 * Each immediate subdirectory of ~/ApiArk/ = workspace.
 * Each immediate subdirectory of a workspace that has .apiark/apiark.yaml = collection.
 */
export async function scanWorkspaces(): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");

  const result = await invoke<{
    workspaces: { name: string; dir: string; collection_paths: string[] }[];
  }>("scan_workspaces");

  const workspaces: Workspace[] = result.workspaces.map((w) => ({
    id: w.dir,
    name: w.name,
    dir: w.dir,
    collectionPaths: w.collection_paths,
  }));

  const savedActiveDir = localStorage.getItem("apiark-active-workspace-dir");
  const active = workspaces.find((w) => w.dir === savedActiveDir) ?? workspaces[0];

  useWorkspaceStore.setState({ workspaces, activeWorkspaceId: active.id, loaded: true });

  const { useCollectionStore } = await import("@/stores/collection-store");
  for (const path of active.collectionPaths) {
    await useCollectionStore.getState().openCollection(path).catch(() => {});
  }

  if (active.collectionPaths.length > 0) {
    const { useEnvironmentStore } = await import("@/stores/environment-store");
    useEnvironmentStore.getState().loadEnvironments(active.collectionPaths[0]).catch(() => {});
  }
}
