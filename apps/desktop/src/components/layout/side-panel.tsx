import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionStore } from "@/stores/collection-store";
import { useTabStore } from "@/stores/tab-store";
import { CollectionTree } from "@/components/collection/collection-tree";
import { EnvironmentSelector } from "@/components/environment/environment-selector";
import { HistoryPanel } from "@/components/history/history-panel";
import { FolderOpen, FolderPlus, Plus, Search, Trash2, X, Upload, FolderX, ChevronDown, ChevronRight, Folder, Globe, Pencil, Settings, Briefcase, Check } from "lucide-react";
import { createCollection, saveEnvironment } from "@/lib/tauri-api";
import { useEnvironmentStore } from "@/stores/environment-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { EnvironmentData, CollectionNode } from "@apiark/types";
import * as Dialog from "@radix-ui/react-dialog";
import type { ActivityView } from "./activity-bar";
import { ProxySidePanel as ProxySidePanelView } from "@/components/proxy/proxy-panel";
import { GitPanel as GitPanelView } from "@/components/git/git-panel";
import { AuditPanel } from "@/components/audit/audit-panel";

interface SidePanelProps {
  activeView: ActivityView;
  envSelectorRef?: React.RefObject<HTMLSelectElement | null>;
  onOpenMock?: () => void;
  onOpenMonitor?: () => void;
  onOpenDocs?: () => void;
  onOpenImport?: () => void;
}

export function SidePanel({
  activeView,
  envSelectorRef,
  onOpenMock,
  onOpenMonitor,
  onOpenDocs,
  onOpenImport,
}: SidePanelProps) {
  const { t } = useTranslation();
  const titles: Record<ActivityView, string> = {
    collections: t("sidebar.collections"),
    environments: t("sidebar.environments"),
    history: t("history.title"),
    mock: t("mock.title"),
    monitor: t("monitor.title"),
    docs: t("docs.title"),
    proxy: "Proxy Capture",
    git: "Git",
    audit: t("audit.title"),
  };

  const sidebarWidth = useSettingsStore((s) => s.settings.sidebarWidth);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [localWidth, setLocalWidth] = useState(sidebarWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => { setLocalWidth(sidebarWidth); }, [sidebarWidth]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = localWidth;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.min(600, Math.max(180, startWidth.current + ev.clientX - startX.current));
      setLocalWidth(newWidth);
    };
    const onUp = (ev: MouseEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      const newWidth = Math.min(600, Math.max(180, startWidth.current + ev.clientX - startX.current));
      updateSettings({ sidebarWidth: newWidth });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [localWidth, updateSettings]);

  return (
    <div
      className="relative flex shrink-0 flex-col border-r border-(--color-border) bg-(--color-surface)"
      style={{ width: `${localWidth}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-(--color-accent)/40 active:bg-(--color-accent)/60 transition-colors"
      />
      {/* Panel header */}
      {activeView === "collections" ? (
        <WorkspaceHeader />
      ) : (
        <div className="flex h-11 shrink-0 items-center px-4">
          <span className="text-sm font-semibold uppercase tracking-wider text-(--color-text-muted)">
            {titles[activeView]}
          </span>
        </div>
      )}

      {/* Panel content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeView === "collections" && <div className="flex-1 overflow-y-auto"><CollectionsPanel onOpenImport={onOpenImport} /></div>}
        {activeView === "environments" && <div className="flex-1 overflow-y-auto"><EnvironmentsPanel envSelectorRef={envSelectorRef} /></div>}
        {activeView === "history" && <HistoryPanel />}
        {activeView === "mock" && <ToolPanel description={t("mock.createDesc")} actionLabel={t("mock.newMockServer")} onAction={onOpenMock} />}
        {activeView === "monitor" && <ToolPanel description={t("monitor.createDesc")} actionLabel={t("monitor.newMonitor")} onAction={onOpenMonitor} />}
        {activeView === "docs" && <ToolPanel description={t("docs.generateDesc")} actionLabel={t("docs.generateDocs")} onAction={onOpenDocs} />}
        {activeView === "proxy" && <ProxySidePanelView />}
        {activeView === "git" && <GitPanelView />}
        {activeView === "audit" && <AuditPanel />}
      </div>
    </div>
  );
}

function WorkspaceHeader() {
  const { workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspace, createWorkspace, renameWorkspace, deleteWorkspace } = useWorkspaceStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const ws = activeWorkspace();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const name = newName.trim();
    setCreating(true);
    setCreateError("");
    try {
      const created = await createWorkspace(name);
      setNewName("");
      setNewDialogOpen(false);
      await setActiveWorkspace(created.id);
    } catch (err) {
      setCreateError(String(err));
    } finally {
      setCreating(false);
    }
  };

  if (!ws) return null;

  return (
    <div className="relative shrink-0 border-b border-(--color-border)">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-11 w-full items-center gap-2 px-4 text-left hover:bg-(--color-elevated) transition-colors"
      >
        <Briefcase className="h-4 w-4 shrink-0 text-(--color-accent)" />
        <span className="flex-1 truncate text-sm font-semibold text-(--color-text-primary)">{ws.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-(--color-text-dimmed)" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 right-0 z-50 rounded-b-lg border border-t-0 border-(--color-border) bg-(--color-elevated) py-1 shadow-xl">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-(--color-text-dimmed)">
              Workspaces
            </div>
            {workspaces.map((w) => (
              <div key={w.id} className="group flex items-center gap-1 px-1">
                {renamingId === w.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => { if (renameValue.trim()) renameWorkspace(w.id, renameValue.trim()); setRenamingId(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { if (renameValue.trim()) renameWorkspace(w.id, renameValue.trim()); setRenamingId(null); }
                      else if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="flex-1 rounded bg-(--color-surface) px-2 py-1 text-sm text-(--color-text-primary) outline-none focus:ring-1 focus:ring-(--color-accent)/50"
                  />
                ) : (
                  <button
                    onClick={async () => { setMenuOpen(false); await setActiveWorkspace(w.id); }}
                    className="flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-(--color-text-primary) hover:bg-(--color-border) transition-colors"
                  >
                    {w.id === activeWorkspaceId
                      ? <Check className="h-3 w-3 shrink-0 text-(--color-accent)" />
                      : <span className="h-3 w-3 shrink-0" />}
                    <span className="flex-1 truncate">{w.name}</span>
                  </button>
                )}
                <button
                  onClick={() => { setRenameValue(w.name); setRenamingId(w.id); }}
                  className="hidden rounded p-1 text-(--color-text-dimmed) hover:text-(--color-text-secondary) group-hover:flex"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {workspaces.length > 1 && (
                  <button
                    onClick={() => deleteWorkspace(w.id)}
                    className="hidden rounded p-1 text-(--color-text-dimmed) hover:text-red-400 group-hover:flex"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <div className="mx-2 my-1 border-t border-(--color-border)" />
            <button
              onClick={() => { setMenuOpen(false); setNewName(""); setNewDialogOpen(true); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--color-text-secondary) hover:bg-(--color-border) transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Workspace
            </button>
          </div>
        </>
      )}

      <Dialog.Root open={newDialogOpen} onOpenChange={(v) => { if (!creating) { setNewDialogOpen(v); if (!v) { setNewName(""); setCreateError(""); } } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-(--color-border) bg-(--color-elevated) p-5 shadow-2xl focus:outline-none">
            <Dialog.Title className="mb-4 text-sm font-semibold text-(--color-text-primary)">
              New Workspace
            </Dialog.Title>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setNewDialogOpen(false); }}
              placeholder="Workspace name"
              className="mb-3 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:border-(--color-accent)/50"
            />
            {createError && (
              <p className="mb-3 text-xs text-red-400">{createError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNewDialogOpen(false)}
                className="rounded-lg px-4 py-1.5 text-sm text-(--color-text-muted) hover:bg-(--color-surface)"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="rounded-lg bg-(--color-accent) px-4 py-1.5 text-sm font-medium text-white hover:bg-(--color-accent-hover) disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function CollectionsPanel({ onOpenImport }: { onOpenImport?: () => void }) {
  const { t } = useTranslation();
  const { collections } = useCollectionStore();
  const { activeWorkspace, addCollection, removeCollection } = useWorkspaceStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [collectionMenu, setCollectionMenu] = useState<{ x: number; y: number; path: string; name: string } | null>(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<{ path: string; name: string } | null>(null);
  const [defaultsPath, setDefaultsPath] = useState<string | null>(null);

  const ws = activeWorkspace();
  const wsCollections = collections.filter(
    (c) => c.type === "collection" && ws.collectionPaths.includes(c.path),
  );


  return (
    <div className="flex flex-col gap-2 px-2 pt-2">
      {/* New / Import action buttons */}
      <div className="flex items-center gap-1 pb-0.5">
        <button
          onClick={() => setNewCollectionOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--color-border) py-1.5 text-xs text-(--color-text-secondary) transition-colors hover:bg-(--color-elevated) hover:text-(--color-text-primary)"
          title={t("sidebar.newCollection")}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          {t("sidebar.new")}
        </button>
        {onOpenImport && (
          <button
            onClick={onOpenImport}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--color-border) py-1.5 text-xs text-(--color-text-secondary) transition-colors hover:bg-(--color-elevated) hover:text-(--color-text-primary)"
            title={t("sidebar.importCollection")}
          >
            <Upload className="h-3.5 w-3.5" />
            {t("sidebar.import")}
          </button>
        )}
      </div>
      {/* Search */}
      {wsCollections.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--color-text-dimmed)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("sidebar.search")}
            className="w-full rounded-lg bg-(--color-elevated) py-1.5 pl-8 pr-7 text-xs text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none transition-colors focus:bg-(--color-card) focus:ring-1 focus:ring-(--color-accent)/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-(--color-text-dimmed) hover:text-(--color-text-secondary)"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}


      {wsCollections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--color-accent-glow)">
            <FolderOpen className="h-6 w-6 text-(--color-accent)" />
          </div>
          <div>
            <p className="text-sm font-medium text-(--color-text-secondary)">{t("sidebar.noCollections")}</p>
            <p className="mt-0.5 text-xs text-(--color-text-dimmed)">
              {t("sidebar.noCollectionsDesc")}
            </p>
          </div>
          <button
            onClick={() => setNewCollectionOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-(--color-accent) px-4 py-2 text-xs font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            {t("sidebar.newCollection")}
          </button>
          {onOpenImport && (
            <button
              onClick={onOpenImport}
              className="flex items-center gap-2 rounded-lg border border-(--color-border) px-4 py-2 text-xs font-medium text-(--color-text-secondary) transition-all hover:bg-(--color-elevated)"
            >
              <Upload className="h-3.5 w-3.5" />
              {t("sidebar.importCollection")}
            </button>
          )}
        </div>
      ) : (
        <>
          {wsCollections.map((collection) => (
            <CollectionHeader
              key={collection.path}
              collection={collection}
              searchQuery={searchQuery}
              onContextMenu={(e) => {
                e.preventDefault();
                setCollectionMenu({ x: e.clientX, y: e.clientY, path: collection.path, name: collection.name });
              }}
              onDelete={() => setDeleteCollectionTarget({ path: collection.path, name: collection.name })}
              onClose={() => removeCollection(collection.path)}
            />
          ))}
          {collectionMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCollectionMenu(null)} />
              <div
                className="fixed z-50 min-w-[160px] rounded border border-(--color-border) bg-(--color-elevated) py-1 shadow-lg"
                style={{ left: collectionMenu.x, top: collectionMenu.y }}
              >
                <button
                  onClick={() => { setDefaultsPath(collectionMenu.path); setCollectionMenu(null); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--color-text-primary) hover:bg-(--color-border)"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Collection Defaults
                </button>
                <button
                  onClick={() => { removeCollection(collectionMenu.path); setCollectionMenu(null); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--color-text-primary) hover:bg-(--color-border)"
                >
                  <FolderX className="h-3.5 w-3.5" />
                  {t("sidebar.closeCollection")}
                </button>
                <button
                  onClick={() => { setDeleteCollectionTarget({ path: collectionMenu.path, name: collectionMenu.name }); setCollectionMenu(null); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-(--color-border)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("sidebar.deleteCollection")}
                </button>
              </div>
            </>
          )}
        </>
      )}

      <NewCollectionDialog
        open={newCollectionOpen}
        onOpenChange={setNewCollectionOpen}
        onCreated={async (path) => { await addCollection(path); }}
      />

      <Dialog.Root open={!!deleteCollectionTarget} onOpenChange={(v) => { if (!v) setDeleteCollectionTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-(--color-border) bg-(--color-elevated) p-5 shadow-2xl">
            <Dialog.Title className="mb-2 text-sm font-semibold text-(--color-text-primary)">
              {t("confirmDelete.title")}
            </Dialog.Title>
            <p className="mb-5 text-sm text-(--color-text-secondary)">
              Delete collection &ldquo;{deleteCollectionTarget?.name}&rdquo;? This will move the entire collection to trash.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteCollectionTarget(null)} className="rounded-lg px-4 py-1.5 text-sm text-(--color-text-muted) hover:bg-(--color-surface)">Cancel</button>
              <button
                onClick={async () => {
                  if (!deleteCollectionTarget) return;
                  const { path, name } = deleteCollectionTarget;
                  setDeleteCollectionTarget(null);
                  removeCollection(path);
                  try {
                    await useCollectionStore.getState().deleteCollection(path, name);
                  } catch (err) {
                    import("@/stores/toast-store").then(({ useToastStore }) =>
                      useToastStore.getState().showError(`Failed to delete collection: ${err}`),
                    );
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {defaultsPath && (
        <CollectionDefaultsDialog
          collectionPath={defaultsPath}
          onClose={() => setDefaultsPath(null)}
        />
      )}
    </div>
  );
}

function CollectionDefaultsDialog({
  collectionPath,
  onClose,
}: {
  collectionPath: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [authType, setAuthType] = useState<string>("none");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKeyKey, setApiKeyKey] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/lib/tauri-api").then(({ getCollectionDefaults }) => {
      getCollectionDefaults(collectionPath).then((defaults) => {
        if (defaults.auth) {
          const auth = defaults.auth as Record<string, unknown>;
          const type = (auth.type as string) ?? "none";
          setAuthType(type);
          if (type === "bearer") setToken((auth.token as string) ?? "");
          if (type === "basic") {
            setUsername((auth.username as string) ?? "");
            setPassword((auth.password as string) ?? "");
          }
          if (type === "api-key") {
            setApiKeyKey((auth.key as string) ?? "");
            setApiKeyValue((auth.value as string) ?? "");
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, [collectionPath]);

  const handleSave = async () => {
    let auth: Record<string, unknown> = { type: "none" };
    if (authType === "bearer") auth = { type: "bearer", token };
    else if (authType === "basic") auth = { type: "basic", username, password };
    else if (authType === "api-key") auth = { type: "api-key", key: apiKeyKey, value: apiKeyValue, addTo: "header" };

    const { getCollectionDefaults, updateCollectionDefaults } = await import("@/lib/tauri-api");
    const current = await getCollectionDefaults(collectionPath);
    await updateCollectionDefaults(collectionPath, { ...current, auth: auth as import("@apiark/types").AuthConfig });
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-(--color-border) bg-(--color-card) p-6 shadow-2xl focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-(--color-text-primary)">
            Collection Defaults
          </Dialog.Title>
          <p className="mt-1 text-xs text-(--color-text-muted)">
            Auth configured here is inherited by all requests without their own auth.
          </p>

          {loading ? (
            <div className="py-8 text-center text-sm text-(--color-text-dimmed)">Loading...</div>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-(--color-text-muted)">
                  {t("auth.type")}
                </label>
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value)}
                  className="w-full rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) outline-none"
                >
                  <option value="none">{t("auth.none")}</option>
                  <option value="bearer">{t("auth.bearer")}</option>
                  <option value="basic">{t("auth.basic")}</option>
                  <option value="api-key">{t("auth.apiKey")}</option>
                </select>
              </div>

              {authType === "bearer" && (
                <input type="text" value={token} onChange={(e) => setToken(e.target.value)} placeholder={t("auth.token")}
                  className="w-full rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none" />
              )}
              {authType === "basic" && (
                <div className="space-y-2">
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.username")}
                    className="w-full rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.password")}
                    className="w-full rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none" />
                </div>
              )}
              {authType === "api-key" && (
                <div className="space-y-2">
                  <input type="text" value={apiKeyKey} onChange={(e) => setApiKeyKey(e.target.value)} placeholder="Header name"
                    className="w-full rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none" />
                  <input type="text" value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)} placeholder="Value"
                    className="w-full rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="rounded-lg px-4 py-1.5 text-sm text-(--color-text-muted) hover:bg-(--color-elevated)">
                  Cancel
                </button>
                <button onClick={handleSave} className="rounded-lg bg-(--color-accent) px-4 py-1.5 text-sm font-medium text-white hover:bg-(--color-accent-hover)">
                  Save
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CollectionHeader({
  collection,
  searchQuery,
  onContextMenu,
  onDelete,
  onClose,
}: {
  collection: CollectionNode;
  searchQuery: string;
  onContextMenu: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { expandedPaths, toggleExpand, renameItem, createRequest, refreshCollection } = useCollectionStore();
  const { openTab } = useTabStore();
  const isExpanded = expandedPaths.has(collection.path);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [newRequestName, setNewRequestName] = useState("");
  const [addingRequest, setAddingRequest] = useState(false);
  const newRequestInputRef = useRef<HTMLInputElement>(null);

  const handleRename = () => {
    setRenameValue(collection.name);
    setRenaming(true);
  };

  const submitRename = async () => {
    setRenaming(false);
    if (!renameValue.trim() || renameValue === collection.name) return;
    try {
      await renameItem(collection.path, renameValue.trim(), collection.path);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to rename: ${err}`),
      );
    }
  };

  const startAddingRequest = () => {
    if (!isExpanded) toggleExpand(collection.path);
    setNewRequestName("");
    setAddingRequest(true);
    setTimeout(() => newRequestInputRef.current?.focus(), 50);
  };

  const submitNewRequest = async () => {
    const name = newRequestName.trim();
    setAddingRequest(false);
    setNewRequestName("");
    if (!name) return;
    try {
      const filename = name.toLowerCase().replace(/\s+/g, "-");
      const path = await createRequest(collection.path, filename, name, collection.path);
      await openTab(path, collection.path);
      await refreshCollection(collection.path);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to create request: ${err}`),
      );
    }
  };

  return (
    <div>
      <button
        onClick={() => toggleExpand(collection.path)}
        onContextMenu={onContextMenu}
        className="group flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-(--color-elevated)"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-(--color-text-muted)" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-(--color-text-muted)" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-(--color-text-muted)" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-(--color-text-muted)" />
        )}
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="min-w-0 flex-1 rounded bg-(--color-elevated) px-1 text-sm text-(--color-text-primary) outline-none ring-1 ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate text-(--color-text-primary)">{collection.name}</span>
        )}
        {!renaming && (
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); startAddingRequest(); }}
              className="rounded p-0.5 text-(--color-text-muted) hover:bg-(--color-border) hover:text-(--color-accent)"
              title="New Request"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleRename(); }}
              className="rounded p-0.5 text-(--color-text-muted) hover:bg-(--color-border) hover:text-(--color-text-primary)"
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded p-0.5 text-(--color-text-muted) hover:bg-red-500/20 hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="rounded p-0.5 text-(--color-text-muted) hover:bg-(--color-border) hover:text-(--color-text-primary)"
              title="Close"
            >
              <FolderX className="h-3 w-3" />
            </button>
          </span>
        )}
      </button>
      {isExpanded && (
        <CollectionTree
          nodes={
            collection.type === "collection"
              ? collection.children
              : [collection]
          }
          collectionPath={collection.path}
          collectionName={collection.name}
          searchQuery={searchQuery}
        />
      )}
      {isExpanded && addingRequest && (
        <div className="flex items-center gap-1.5 px-2 py-1 pl-6">
          <Plus className="h-3 w-3 shrink-0 text-(--color-accent)" />
          <input
            ref={newRequestInputRef}
            value={newRequestName}
            onChange={(e) => setNewRequestName(e.target.value)}
            onBlur={submitNewRequest}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewRequest();
              if (e.key === "Escape") { setAddingRequest(false); setNewRequestName(""); }
            }}
            placeholder="Request name..."
            className="min-w-0 flex-1 rounded bg-(--color-elevated) px-2 py-0.5 text-xs text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none ring-1 ring-(--color-accent)/60"
          />
        </div>
      )}

    </div>
  );
}


function NewCollectionDialog({
  open: isOpen,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (path: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName("");
      setError("");
    }
    onOpenChange(v);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { useWorkspaceStore } = await import("@/stores/workspace-store");
      const parentDir = useWorkspaceStore.getState().activeWorkspaceDir();
      const path = await createCollection(parentDir, name.trim());
      await onCreated(path);
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  const canCreate = name.trim() && !creating;

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xl">
          <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
            <Dialog.Title className="text-sm font-medium text-(--color-text-primary)">
              {t("sidebar.newCollection")}
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-elevated)">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-3 p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-(--color-text-secondary)">
                {t("sidebar.collectionName")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("sidebar.collectionNamePlaceholder")}
                autoFocus
                className="w-full rounded bg-(--color-elevated) px-3 py-2 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-(--color-accent)"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canCreate) handleCreate();
                }}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-(--color-border) px-4 py-3">
            <Dialog.Close className="rounded px-3 py-1.5 text-sm text-(--color-text-secondary) hover:bg-(--color-elevated)">
              {t("common.cancel")}
            </Dialog.Close>
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="rounded bg-(--color-accent) px-4 py-1.5 text-sm font-medium text-white hover:bg-(--color-accent-hover) disabled:opacity-50"
            >
              {creating ? t("sidebar.creating") : t("common.create")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EnvironmentsPanel({
  envSelectorRef,
}: {
  envSelectorRef?: React.RefObject<HTMLSelectElement | null>;
}) {
  const { t } = useTranslation();
  const { environments, activeEnvironmentName, setActiveEnvironment, loadEnvironments } =
    useEnvironmentStore();
  const { collections } = useCollectionStore();
  const [editingEnv, setEditingEnv] = useState<EnvironmentData | null>(null);
  const [newEnvOpen, setNewEnvOpen] = useState(false);

  const collectionPath =
    collections.find((c) => c.type === "collection")?.path ?? null;

  // Load environments when panel mounts with a collection
  useEffect(() => {
    if (collectionPath) {
      loadEnvironments(collectionPath);
    }
  }, [collectionPath, loadEnvironments]);

  const handleSave = async (env: EnvironmentData) => {
    if (!collectionPath) return;
    try {
      await saveEnvironment(collectionPath, env);
      await loadEnvironments(collectionPath);
      setEditingEnv(null);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to save environment: ${err}`),
      );
    }
  };

  const handleImportEnv = async () => {
    if (!collectionPath) return;
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        filters: [{ name: "Postman Environment", extensions: ["json"] }],
        multiple: true,
      });
      if (!selected) return;
      const files = Array.isArray(selected) ? selected : [selected];
      const { importEnvironment } = await import("@/lib/tauri-api");
      let imported = 0;
      for (const file of files) {
        try {
          await importEnvironment(file, collectionPath);
          imported++;
        } catch (err) {
          import("@/stores/toast-store").then(({ useToastStore }) =>
            useToastStore.getState().showWarning(`Skipped ${file.split("/").pop()}: ${err}`),
          );
        }
      }
      if (imported > 0) {
        await loadEnvironments(collectionPath);
        import("@/stores/toast-store").then(({ useToastStore }) =>
          useToastStore.getState().showSuccess(`Imported ${imported} environment${imported > 1 ? "s" : ""}`),
        );
      }
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to import: ${err}`),
      );
    }
  };

  const handleCreateNew = async (name: string) => {
    if (!collectionPath) return;
    const env: EnvironmentData = { name, variables: {}, secrets: [] };
    try {
      await saveEnvironment(collectionPath, env);
      await loadEnvironments(collectionPath);
      setActiveEnvironment(name);
      setNewEnvOpen(false);
      // Open editor for the new environment
      setEditingEnv(env);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to create environment: ${err}`),
      );
    }
  };

  if (!collectionPath) {
    const handleOpenFolder = async () => {
      try {
        const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
        const selected = await openDialog({ directory: true, multiple: false });
        if (selected) {
          await useCollectionStore.getState().openCollection(selected as string);
        }
      } catch (err) {
        import("@/stores/toast-store").then(({ useToastStore }) =>
          useToastStore.getState().showError(`Failed to open folder: ${err}`),
        );
      }
    };

    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/10">
          <Globe className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-(--color-text-secondary)">{t("sidebar.noCollections")}</p>
          <p className="mt-0.5 text-xs text-(--color-text-dimmed)">
            {t("sidebar.openCollectionFirst")}
          </p>
        </div>
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-4 py-2 text-xs font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {t("sidebar.openCollection")}
        </button>
      </div>
    );
  }

  // Editing an environment — show variable editor
  if (editingEnv) {
    return (
      <EnvironmentEditor
        env={editingEnv}
        onSave={handleSave}
        onBack={() => setEditingEnv(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {/* Environment selector */}
      <EnvironmentSelector ref={envSelectorRef} />

      {/* Environment list with edit buttons */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-(--color-text-dimmed)">
            {t("sidebar.environments")}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleImportEnv}
              className="rounded p-1 text-(--color-text-dimmed) hover:bg-(--color-elevated) hover:text-(--color-text-secondary)"
              title={t("sidebar.importEnvironment")}
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              onClick={() => setNewEnvOpen(true)}
              className="rounded p-1 text-(--color-text-dimmed) hover:bg-(--color-elevated) hover:text-(--color-text-secondary)"
              title={t("sidebar.newEnvironment")}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {environments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-xs text-(--color-text-dimmed)">
              {t("sidebar.noEnvironmentsYet")}
            </p>
            <button
              onClick={() => setNewEnvOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-3 py-1.5 text-xs font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("sidebar.newEnvironment")}
            </button>
          </div>
        ) : (
          environments.map((env) => (
            <button
              key={env.name}
              onClick={() => setEditingEnv(env)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                activeEnvironmentName === env.name
                  ? "bg-(--color-accent)/10 text-(--color-accent)"
                  : "text-(--color-text-primary) hover:bg-(--color-elevated)"
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="truncate">{env.name}</span>
                {env.scope === "personal" && (
                  <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-bold text-amber-400">
                    LOCAL
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-(--color-text-dimmed)">
                {Object.keys(env.variables).length} vars
              </span>
            </button>
          ))
        )}
      </div>

      {/* New environment dialog */}
      <NewEnvironmentDialog
        open={newEnvOpen}
        onOpenChange={setNewEnvOpen}
        onCreate={handleCreateNew}
      />
    </div>
  );
}

function EnvironmentEditor({
  env,
  onSave,
  onBack,
}: {
  env: EnvironmentData;
  onSave: (env: EnvironmentData) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(env.name);
  const [variables, setVariables] = useState<{ key: string; value: string }[]>(
    () => {
      const entries = Object.entries(env.variables).map(([key, value]) => ({ key, value }));
      if (entries.length === 0) entries.push({ key: "", value: "" });
      return entries;
    },
  );

  const [scope, setScope] = useState<"shared" | "personal">(env.scope ?? "shared");

  const handleSave = () => {
    const vars: Record<string, string> = {};
    for (const v of variables) {
      if (v.key.trim()) vars[v.key.trim()] = v.value;
    }
    onSave({ ...env, name: name.trim() || env.name, variables: vars, scope });
  };

  const updateVar = (index: number, field: "key" | "value", val: string) => {
    setVariables((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: val } : v)));
  };

  const addVar = () => {
    setVariables((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeVar = (index: number) => {
    setVariables((prev) => {
      if (prev.length <= 1) return [{ key: "", value: "" }];
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-elevated)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 truncate rounded bg-transparent px-1 text-sm font-medium text-(--color-text-primary) outline-none focus:bg-(--color-elevated) focus:ring-1 focus:ring-(--color-accent)"
        />
        <button
          onClick={handleSave}
          className="shrink-0 rounded bg-(--color-accent) px-2.5 py-1 text-xs font-medium text-white hover:bg-(--color-accent-hover)"
        >
          {t("common.save")}
        </button>
      </div>

      {/* Scope toggle */}
      <div className="flex items-center gap-2 rounded bg-(--color-elevated) px-2 py-1.5">
        <span className="text-[10px] text-(--color-text-dimmed)">Scope:</span>
        <button
          onClick={() => setScope("shared")}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
            scope === "shared"
              ? "bg-blue-500/20 text-blue-400"
              : "text-(--color-text-muted) hover:text-(--color-text-secondary)"
          }`}
        >
          Shared
        </button>
        <button
          onClick={() => setScope("personal")}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
            scope === "personal"
              ? "bg-amber-500/20 text-amber-400"
              : "text-(--color-text-muted) hover:text-(--color-text-secondary)"
          }`}
        >
          Personal
        </button>
      </div>

      {/* Variables */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-(--color-text-dimmed)">
            {t("environment.variables")}
          </span>
        </div>

        {variables.map((v, i) => (
          <div key={i} className="flex gap-1">
            <input
              type="text"
              value={v.key}
              onChange={(e) => updateVar(i, "key", e.target.value)}
              placeholder={t("request.key")}
              className="min-w-0 flex-1 basis-0 rounded bg-(--color-elevated) px-2 py-1 text-xs text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
            <input
              type="text"
              value={v.value}
              onChange={(e) => updateVar(i, "value", e.target.value)}
              placeholder={t("request.value")}
              className="min-w-0 flex-1 basis-0 rounded bg-(--color-elevated) px-2 py-1 text-xs text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
            <button
              onClick={() => removeVar(i)}
              className="shrink-0 rounded p-1 text-(--color-text-dimmed) hover:bg-(--color-elevated) hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          onClick={addVar}
          className="flex items-center gap-1 text-xs text-(--color-text-dimmed) hover:text-(--color-text-secondary)"
        >
          <Plus className="h-3 w-3" /> {t("sidebar.addVariable")}
        </button>
      </div>
    </div>
  );
}

function NewEnvironmentDialog({
  open: isOpen,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (v) setName("");
    onOpenChange(v);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xl">
          <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
            <Dialog.Title className="text-sm font-medium text-(--color-text-primary)">
              {t("sidebar.newEnvironment")}
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-elevated)">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="p-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Development, Staging, Production"
              autoFocus
              className="w-full rounded bg-(--color-elevated) px-3 py-2 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-(--color-accent)"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) onCreate(name.trim());
              }}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-(--color-border) px-4 py-3">
            <Dialog.Close className="rounded px-3 py-1.5 text-sm text-(--color-text-secondary) hover:bg-(--color-elevated)">
              {t("common.cancel")}
            </Dialog.Close>
            <button
              onClick={() => name.trim() && onCreate(name.trim())}
              disabled={!name.trim()}
              className="rounded bg-(--color-accent) px-4 py-1.5 text-sm font-medium text-white hover:bg-(--color-accent-hover) disabled:opacity-50"
            >
              {t("common.create")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ToolPanel({
  description,
  actionLabel,
  onAction,
}: {
  description: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <p className="text-sm text-(--color-text-secondary)">{description}</p>
      <button
        onClick={onAction}
        className="rounded-lg bg-(--color-accent) px-4 py-2 text-xs font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
      >
        {actionLabel}
      </button>
    </div>
  );
}
