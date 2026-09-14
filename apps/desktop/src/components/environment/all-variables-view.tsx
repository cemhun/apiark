import { useEffect, useId, useMemo, useState } from "react";
import { Globe, Layers, FlaskConical, FileCode, Eye, EyeOff, Plus, Trash2, Loader2, Zap } from "lucide-react";
import { useEnvironmentStore } from "@/stores/environment-store";
import { loadRootDotenv, saveEnvironment } from "@/lib/tauri-api";

interface VariableRow {
  key: string;
  value: string;
}

function toRows(vars: Record<string, string>): VariableRow[] {
  return Object.entries(vars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));
}

function showError(message: string) {
  import("@/stores/toast-store").then(({ useToastStore }) =>
    useToastStore.getState().showError(message),
  );
}

/**
 * Full-page overview and editor of every variable layer available to
 * `{{variable}}` interpolation, from lowest to highest precedence:
 *
 *   Collection Variables < root .env < environment variables < globals < session (ark.env)
 *
 * (`ark.globals` are script-writable and persisted to disk. `ark.env.set()`
 * writes to the in-memory "Session" layer instead — it always wins, but is
 * cleared when the app restarts; see environment-store.getResolvedVariables().)
 *
 * Global, Collection, Environment, and Session variables can be
 * added/edited/removed directly here. Root `.env` is a plain file and shown
 * read-only (edit it in your editor). Secret *values* live in `.apiark/.env`
 * and aren't editable here either — only which variable names are sourced
 * from it.
 */
export function AllVariablesView() {
  const {
    activeCollectionPath,
    activeEnvironmentName,
    environments,
    globals,
    collectionVariables,
    runtimeOverrides,
  } = useEnvironmentStore();
  const [rootVars, setRootVars] = useState<Record<string, string>>({});
  const [revealSecrets, setRevealSecrets] = useState(false);
  const [selectedEnvName, setSelectedEnvName] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCollectionPath) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedEnvName(activeEnvironmentName ?? environments[0]?.name ?? null);
    loadRootDotenv(activeCollectionPath)
      .then(setRootVars)
      .catch(() => setRootVars({}));
    // Only re-run when the active collection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollectionPath]);

  const selectedEnv = useMemo(
    () => environments.find((e) => e.name === selectedEnvName) ?? null,
    [environments, selectedEnvName],
  );

  // Merged view mirrors storage::environment::get_resolved_variables precedence,
  // plus globals applied on top (see environment-store.getResolvedVariables()).
  const merged = useMemo(() => {
    const result: Record<string, { value: string; source: string }> = {};
    for (const [k, v] of Object.entries(collectionVariables)) {
      result[k] = { value: v, source: "Collection" };
    }
    for (const [k, v] of Object.entries(rootVars)) {
      result[k] = { value: v, source: ".env" };
    }
    if (selectedEnv) {
      for (const [k, v] of Object.entries(selectedEnv.variables)) {
        result[k] = { value: v, source: selectedEnv.name };
      }
      for (const secretKey of selectedEnv.secrets ?? []) {
        result[secretKey] = { value: "••••••••", source: `${selectedEnv.name} (secret)` };
      }
    }
    for (const [k, v] of Object.entries(globals)) {
      result[k] = { value: v, source: "Global" };
    }
    for (const [k, v] of Object.entries(runtimeOverrides)) {
      result[k] = { value: v, source: "Session (ark.env)" };
    }
    return Object.entries(result).sort(([a], [b]) => a.localeCompare(b));
  }, [collectionVariables, rootVars, selectedEnv, globals, runtimeOverrides]);

  if (!activeCollectionPath) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-sm text-(--color-text-dimmed)">
          Open a collection to see its variables.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-(--color-border) px-5 py-3">
        <h2 className="text-sm font-semibold text-(--color-text-primary)">All Variables</h2>
        <p className="mt-0.5 text-xs text-(--color-text-dimmed)">
          Every variable available to <code className="rounded bg-(--color-elevated) px-1">{"{{name}}"}</code>{" "}
          interpolation. Add, edit, or remove Global, Collection, and Environment variables directly below.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-(--color-border) px-5 py-2.5">
        <label className="flex items-center gap-2 text-xs text-(--color-text-muted)">
          <span>Environment</span>
          <select
            value={selectedEnvName ?? ""}
            onChange={(e) => setSelectedEnvName(e.target.value || null)}
            className="rounded bg-(--color-elevated) px-2 py-1 text-xs text-(--color-text-primary) outline-none"
          >
            <option value="">None</option>
            {environments.map((env) => (
              <option key={env.name} value={env.name}>
                {env.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setRevealSecrets((v) => !v)}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-(--color-text-dimmed) hover:bg-(--color-elevated) hover:text-(--color-text-secondary)"
        >
          {revealSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {revealSecrets ? "Hide secrets" : "Reveal secrets"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <EditableVariableSection
          key={`global-${activeCollectionPath}`}
          icon={<Layers className="h-3.5 w-3.5 text-emerald-400" />}
          title="Global"
          hint="ark.globals — script-writable, shared across all environments and requests."
          values={globals}
          onSave={(next) => {
            const mutations: Record<string, string | null> = {};
            for (const key of Object.keys(globals)) {
              if (!(key in next)) mutations[key] = null;
            }
            for (const [key, value] of Object.entries(next)) mutations[key] = value;
            useEnvironmentStore.getState().applyGlobalMutations(mutations);
          }}
        />
        <EditableVariableSection
          key={`collection-${activeCollectionPath}`}
          icon={<FileCode className="h-3.5 w-3.5 text-amber-400" />}
          title="Collection"
          hint="Collection Defaults — shared, committed variables. Lowest priority."
          values={collectionVariables}
          onSave={(next) => {
            const mutations: Record<string, string | null> = {};
            for (const key of Object.keys(collectionVariables)) {
              if (!(key in next)) mutations[key] = null;
            }
            for (const [key, value] of Object.entries(next)) mutations[key] = value;
            useEnvironmentStore.getState().applyCollectionVariableMutations(mutations);
          }}
        />
        <VariableSection
          icon={<Globe className="h-3.5 w-3.5 text-blue-400" />}
          title=".env (root)"
          hint="Root .env file at the collection's root directory — read-only here, edit the file directly."
          rows={toRows(rootVars)}
        />
        <EditableVariableSection
          key={`env-vars-${activeCollectionPath}-${selectedEnv?.name ?? "none"}`}
          icon={<FlaskConical className="h-3.5 w-3.5 text-purple-400" />}
          title={selectedEnv ? `Environment — ${selectedEnv.name}` : "Environment"}
          hint="Values from the selected environment (highest priority, aside from secrets/globals)."
          values={selectedEnv?.variables ?? {}}
          disabled={!selectedEnv}
          disabledMessage="Select or create an environment to edit its variables."
          onSave={async (next) => {
            if (!selectedEnv || !activeCollectionPath) return;
            try {
              await saveEnvironment(activeCollectionPath, { ...selectedEnv, variables: next });
              await useEnvironmentStore.getState().loadEnvironments(activeCollectionPath);
            } catch (err) {
              showError(`Failed to save environment variables: ${err}`);
            }
          }}
        />
        <SecretKeysEditor
          key={`env-secrets-${activeCollectionPath}-${selectedEnv?.name ?? "none"}`}
          secrets={selectedEnv?.secrets ?? []}
          disabled={!selectedEnv}
          revealSecrets={revealSecrets}
          onSave={async (nextSecrets) => {
            if (!selectedEnv || !activeCollectionPath) return;
            try {
              await saveEnvironment(activeCollectionPath, { ...selectedEnv, secrets: nextSecrets });
              await useEnvironmentStore.getState().loadEnvironments(activeCollectionPath);
            } catch (err) {
              showError(`Failed to save secret keys: ${err}`);
            }
          }}
        />

        <EditableVariableSection
          key={`session-${activeCollectionPath}`}
          icon={<Zap className="h-3.5 w-3.5 text-yellow-400" />}
          title="Session"
          hint="ark.env.set()/.unset() — highest priority, but in-memory only for this run of the app (not saved to disk, cleared on restart)."
          values={runtimeOverrides}
          onSave={(next) => {
            const mutations: Record<string, string | null> = {};
            for (const key of Object.keys(runtimeOverrides)) {
              if (!(key in next)) mutations[key] = null;
            }
            for (const [key, value] of Object.entries(next)) mutations[key] = value;
            useEnvironmentStore.getState().applyMutations(mutations);
          }}
        />

        <div className="mt-5 border-t border-(--color-border) pt-4">
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-(--color-text-dimmed)">
            Resolved (merged, current selection)
          </h3>
          {merged.length === 0 ? (
            <p className="text-xs text-(--color-text-dimmed)">No variables defined yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-(--color-border)">
              <table className="w-full text-xs">
                <thead className="bg-(--color-elevated) text-(--color-text-dimmed)">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Name</th>
                    <th className="px-3 py-1.5 text-left font-medium">Value</th>
                    <th className="px-3 py-1.5 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {merged.map(([key, { value, source }]) => (
                    <tr key={key} className="border-t border-(--color-border)">
                      <td className="px-3 py-1.5 font-mono text-(--color-text-primary)">{key}</td>
                      <td className="max-w-56 truncate px-3 py-1.5 font-mono text-(--color-text-secondary)" title={value}>
                        {value.includes("•") && !revealSecrets ? value : value || "\u00A0"}
                      </td>
                      <td className="px-3 py-1.5 text-(--color-text-dimmed)">{source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Read-only pill list — used only for the root `.env` section. */
function VariableSection({
  icon,
  title,
  hint,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  rows: VariableRow[];
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-semibold text-(--color-text-primary)">{title}</h3>
        <span className="text-[10px] text-(--color-text-dimmed)">({rows.length})</span>
      </div>
      <p className="mb-1.5 text-[11px] text-(--color-text-dimmed)">{hint}</p>
      {rows.length === 0 ? (
        <p className="rounded bg-(--color-elevated)/50 px-2 py-1.5 text-[11px] text-(--color-text-dimmed)">
          None defined
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rows.map((row) => (
            <span
              key={row.key}
              className="rounded bg-(--color-elevated) px-2 py-1 font-mono text-[11px] text-(--color-text-secondary)"
              title={`${row.key} = ${row.value}`}
            >
              <span className="text-(--color-text-primary)">{row.key}</span>
              <span className="text-(--color-text-dimmed)"> = </span>
              {row.value || "\u00A0"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface EditRow {
  id: string;
  key: string;
  value: string;
}

function rowsFromValues(values: Record<string, string>): EditRow[] {
  return Object.entries(values).map(([key, value], i) => ({ id: `${i}-${key}`, key, value }));
}

/**
 * Editable key/value list with add/remove rows and an explicit "Save"
 * action. Used for Global, Collection, and Environment variables. Remounted
 * (via a `key` prop from the parent) whenever the active collection or
 * environment changes, so local edit state always starts fresh and in sync.
 */
function EditableVariableSection({
  icon,
  title,
  hint,
  values,
  disabled,
  disabledMessage,
  onSave,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  values: Record<string, string>;
  disabled?: boolean;
  disabledMessage?: string;
  onSave: (next: Record<string, string>) => void | Promise<void>;
}) {
  const idPrefix = useId();
  const [rows, setRows] = useState<EditRow[]>(() => rowsFromValues(values));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  let nextId = rows.length;

  const addRow = () => {
    setRows((prev) => [...prev, { id: `${idPrefix}-new-${nextId++}`, key: "", value: "" }]);
    setDirty(true);
  };

  const updateKey = (id: string, key: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, key } : r)));
    setDirty(true);
  };

  const updateValue = (id: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
    setDirty(true);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
  };

  const handleSave = async () => {
    const next: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (key) next[key] = row.value;
    }
    setSaving(true);
    try {
      await onSave(next);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-5">
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-semibold text-(--color-text-primary)">{title}</h3>
        <span className="text-[10px] text-(--color-text-dimmed)">({rows.length})</span>
        <div className="flex-1" />
        {!disabled && (
          <>
            <button
              onClick={addRow}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-(--color-text-dimmed) hover:bg-(--color-elevated) hover:text-(--color-text-secondary)"
              title="Add variable"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 rounded bg-(--color-accent) px-2 py-0.5 text-[11px] font-medium text-white hover:bg-(--color-accent-hover) disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </button>
            )}
          </>
        )}
      </div>
      <p className="mb-1.5 text-[11px] text-(--color-text-dimmed)">{hint}</p>

      {disabled ? (
        <p className="rounded bg-(--color-elevated)/50 px-2 py-1.5 text-[11px] text-(--color-text-dimmed)">
          {disabledMessage ?? "Not available."}
        </p>
      ) : rows.length === 0 ? (
        <button
          onClick={addRow}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-(--color-border) py-2 text-[11px] text-(--color-text-dimmed) hover:border-(--color-accent)/50 hover:text-(--color-text-secondary)"
        >
          <Plus className="h-3 w-3" /> Add the first variable
        </button>
      ) : (
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-1.5">
              <input
                type="text"
                value={row.key}
                onChange={(e) => updateKey(row.id, e.target.value)}
                placeholder="name"
                className="w-2/5 min-w-0 rounded bg-(--color-elevated) px-2 py-1 font-mono text-[11px] text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-(--color-accent)"
              />
              <input
                type="text"
                value={row.value}
                onChange={(e) => updateValue(row.id, e.target.value)}
                placeholder="value"
                className="min-w-0 flex-1 rounded bg-(--color-elevated) px-2 py-1 font-mono text-[11px] text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-(--color-accent)"
              />
              <button
                onClick={() => removeRow(row.id)}
                className="shrink-0 rounded p-1 text-(--color-text-dimmed) hover:bg-(--color-elevated) hover:text-red-400"
                title="Remove variable"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Editor for an environment's `secrets` list — declares which variable names
 * are sourced from `.apiark/.env` at request time. The secret *values* live
 * in that (gitignored) file and aren't editable here; use the sidebar's
 * environment editor or edit `.apiark/.env` directly to set values.
 */
function SecretKeysEditor({
  secrets,
  disabled,
  revealSecrets,
  onSave,
}: {
  secrets: string[];
  disabled?: boolean;
  revealSecrets: boolean;
  onSave: (next: string[]) => void | Promise<void>;
}) {
  const idPrefix = useId();
  const [rows, setRows] = useState<{ id: string; key: string }[]>(() =>
    secrets.map((key, i) => ({ id: `${i}-${key}`, key })),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  let nextId = rows.length;

  const addRow = () => {
    setRows((prev) => [...prev, { id: `${idPrefix}-new-${nextId++}`, key: "" }]);
    setDirty(true);
  };
  const updateKey = (id: string, key: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, key } : r)));
    setDirty(true);
  };
  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
  };

  const handleSave = async () => {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const row of rows) {
      const key = row.key.trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        next.push(key);
      }
    }
    setSaving(true);
    try {
      await onSave(next);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-5">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-(--color-text-dimmed)">
          Secrets
        </span>
        <span className="text-[10px] text-(--color-text-dimmed)">({rows.length})</span>
        <div className="flex-1" />
        {!disabled && (
          <>
            <button
              onClick={addRow}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-(--color-text-dimmed) hover:bg-(--color-elevated) hover:text-(--color-text-secondary)"
              title="Declare a secret variable name"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 rounded bg-(--color-accent) px-2 py-0.5 text-[11px] font-medium text-white hover:bg-(--color-accent-hover) disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </button>
            )}
          </>
        )}
      </div>
      <p className="mb-1.5 text-[11px] text-(--color-text-dimmed)">
        Declares which variable names come from <code className="rounded bg-(--color-elevated) px-1">.apiark/.env</code>{" "}
        (highest priority, gitignored). Edit that file directly to set/change the actual secret values.
      </p>

      {disabled ? (
        <p className="rounded bg-(--color-elevated)/50 px-2 py-1.5 text-[11px] text-(--color-text-dimmed)">
          Select or create an environment to manage its secrets.
        </p>
      ) : rows.length === 0 ? (
        <button
          onClick={addRow}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-(--color-border) py-2 text-[11px] text-(--color-text-dimmed) hover:border-(--color-accent)/50 hover:text-(--color-text-secondary)"
        >
          <Plus className="h-3 w-3" /> Declare a secret variable
        </button>
      ) : (
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-1.5">
              <input
                type="text"
                value={row.key}
                onChange={(e) => updateKey(row.id, e.target.value)}
                placeholder="name"
                className="w-2/5 min-w-0 rounded bg-(--color-elevated) px-2 py-1 font-mono text-[11px] text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-(--color-accent)"
              />
              <span className="min-w-0 flex-1 truncate rounded bg-(--color-elevated)/50 px-2 py-1 font-mono text-[11px] text-(--color-text-dimmed)">
                {revealSecrets ? "•••• (stored in .apiark/.env)" : "••••••••"}
              </span>
              <button
                onClick={() => removeRow(row.id)}
                className="shrink-0 rounded p-1 text-(--color-text-dimmed) hover:bg-(--color-elevated) hover:text-red-400"
                title="Remove secret"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

