import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { KeyValueEditor } from "./key-value-editor";
import type { AuthConfig, BodyType, RequestBody, KeyValuePair, OAuth2GrantType, OAuthTokenStatus } from "@apiark/types";
import { oauthStartFlow, oauthGetTokenStatus, oauthClearToken } from "@/lib/tauri-api";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { CodeEditor } from "@/components/ui/code-editor";
import { Plus, Trash2, FileUp, Wand2, AlignJustify, LayoutList, Eye, EyeOff } from "lucide-react";

/** Extract :paramName path variables from a URL */
function extractPathVariables(url: string): string[] {
  const matches = url.match(/:([a-zA-Z_][\w]*)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

type Tab = "params" | "headers" | "body" | "auth" | "scripts" | "tests";

const TAB_IDS: Tab[] = ["params", "headers", "body", "auth", "scripts", "tests"];

const TAB_LABEL_KEYS: Record<Tab, string> = {
  params: "request.params",
  headers: "request.headers",
  body: "request.body",
  auth: "request.auth",
  scripts: "request.scripts",
  tests: "request.tests",
};

const BODY_TYPE_IDS: BodyType[] = ["none", "json", "xml", "raw", "urlencoded", "form-data"];

const BODY_TYPE_LABEL_KEYS: Record<BodyType, string> = {
  none: "body.none",
  json: "body.json",
  xml: "body.xml",
  raw: "body.raw",
  urlencoded: "body.urlencoded",
  "form-data": "body.formData",
  binary: "body.binary",
};

export function RequestPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("body");
  const tab = useActiveTab();
  const {
    setParams,
    setHeaders,
    setBody,
    setAuth,
    setUrl,
    setPathVariables,
    setPreRequestScript,
    setPostResponseScript,
    setTestScript,
    setAssertions,
    send,
  } = useTabStore();

  const pathVars = useMemo(() => tab ? extractPathVariables(tab.url) : [], [tab?.url]);

  // Default to the "body" tab whenever the user opens/switches to a different request.
  useEffect(() => {
    setActiveTab("body");
  }, [tab?.id]);

  if (!tab) return null;

  const { params, headers, body, auth, pathVariables } = tab;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-0 overflow-x-auto border-b border-(--color-border) bg-(--color-surface)">
        {TAB_IDS.map((tabId) => (
          <button
            key={tabId}
            data-tour={`tab-${tabId}`}
            onClick={() => setActiveTab(tabId)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm transition-colors ${
              activeTab === tabId
                ? "border-b-2 border-blue-500 text-(--color-text-primary)"
                : "text-(--color-text-muted) hover:text-(--color-text-secondary)"
            }`}
          >
            {t(TAB_LABEL_KEYS[tabId])}
            {tabId === "params" && params.filter((p) => p.key).length > 0 && (
              <span className="ml-1 text-xs text-(--color-text-dimmed)">
                ({params.filter((p) => p.key).length})
              </span>
            )}
            {tabId === "headers" && headers.filter((h) => h.key).length > 0 && (
              <span className="ml-1 text-xs text-(--color-text-dimmed)">
                ({headers.filter((h) => h.key).length})
              </span>
            )}
            {tabId === "scripts" && (tab.preRequestScript || tab.postResponseScript) && (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            )}
            {tabId === "tests" && (tab.testScript || tab.assertions) && (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`flex-1 p-3 ${activeTab === "body" ? "flex flex-col overflow-hidden" : "overflow-auto"}`}>
        {activeTab === "params" && (
          <div className="relative space-y-4">
            <PathVariablesEditor
              url={tab.url}
              pathVars={pathVars}
              values={pathVariables}
              onChange={setPathVariables}
              onUrlChange={setUrl}
            />
            <KeyValueEditor
              pairs={params}
              onChange={setParams}
              keyPlaceholder="Parameter"
              valuePlaceholder={t("request.value")}
            />
            <HintTooltip hintId="env-vars" message="Tip: Use {{variableName}} for dynamic values from environments" />
          </div>
        )}

        {activeTab === "headers" && (
          <HeadersEditor
            headers={headers}
            onChange={setHeaders}
          />
        )}

        {activeTab === "body" && (
          <BodyEditor body={body} onChange={setBody} onCmdEnter={send} />
        )}

        {activeTab === "auth" && (
          <AuthEditor auth={auth} onChange={setAuth} />
        )}

        {activeTab === "scripts" && (
          <ScriptsEditor
            preRequestScript={tab.preRequestScript}
            postResponseScript={tab.postResponseScript}
            onPreRequestChange={setPreRequestScript}
            onPostResponseChange={setPostResponseScript}
          />
        )}

        {activeTab === "tests" && (
          <TestsEditor
            assertions={tab.assertions}
            testScript={tab.testScript}
            onAssertionsChange={setAssertions}
            onTestScriptChange={setTestScript}
          />
        )}
      </div>
    </div>
  );
}

function PathVariablesEditor({
  url,
  pathVars,
  values,
  onChange,
  onUrlChange,
}: {
  url: string;
  pathVars: string[];
  values: Record<string, string>;
  onChange: (pathVariables: Record<string, string>) => void;
  onUrlChange: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [newVarName, setNewVarName] = useState("");

  const handleChange = (paramName: string, value: string) => {
    onChange({ ...values, [paramName]: value });
  };

  const handleAdd = () => {
    const name = newVarName.trim();
    if (!name || pathVars.includes(name)) return;
    const separator = url.endsWith("/") ? "" : "/";
    onUrlChange(`${url}${separator}:${name}`);
    setNewVarName("");
  };

  const handleRemove = (param: string) => {
    // Remove :param from the URL
    const updated = url
      .replace(new RegExp(`/:${param}(?=/|$)`), "")
      .replace(new RegExp(`(?<![\\w]):${param}(?=/|$)`), "");
    onUrlChange(updated || "/");
    const next = { ...values };
    delete next[param];
    onChange(next);
  };

  if (pathVars.length === 0 && !newVarName) return null;

  return (
    <div className="space-y-1">
      {/* Header row — matches KeyValueEditor layout */}
      <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-1 text-xs text-(--color-text-muted)">
        <span>{t("request.pathVariables")}</span>
        <span>{t("request.value")}</span>
        <span className="w-7" />
      </div>

      {/* Rows */}
      {pathVars.map((param) => (
        <div key={param} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-1">
          <div className="flex items-center rounded bg-(--color-elevated) px-2 py-1 text-sm font-medium text-purple-400">
            :{param}
          </div>
          <input
            type="text"
            value={values[param] ?? ""}
            onChange={(e) => handleChange(param, e.target.value)}
            placeholder={t("request.value")}
            className="rounded bg-(--color-elevated) px-2 py-1 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => handleRemove(param)}
            className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-border) hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Add row — only show when no path vars exist yet or user started typing */}
      {(pathVars.length === 0 || newVarName) && (
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-1">
          <input
            type="text"
            value={newVarName}
            onChange={(e) => setNewVarName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder={t("request.variableName")}
            className="rounded bg-(--color-elevated) px-2 py-1 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div />
          <button
            onClick={handleAdd}
            disabled={!newVarName.trim() || pathVars.includes(newVarName.trim())}
            className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-border) hover:text-(--color-text-primary) disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

let formKvCounter = 0;
const formKvId = () => `kv_fd_${Date.now()}_${++formKvCounter}`;

function FormDataEditor({
  pairs,
  onChange,
}: {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
}) {
  const { t } = useTranslation();
  const update = (index: number, field: string, value: string | boolean) => {
    const updated = pairs.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    onChange(updated);
  };

  const addRow = () => {
    onChange([...pairs, { id: formKvId(), key: "", value: "", enabled: true }]);
  };

  const removeRow = (index: number) => {
    if (pairs.length <= 1) {
      onChange([{ id: formKvId(), key: "", value: "", enabled: true }]);
      return;
    }
    onChange(pairs.filter((_, i) => i !== index));
  };

  const pickFile = async (index: number) => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false });
      if (selected) {
        const path = typeof selected === "string" ? selected : selected;
        const updated = pairs.map((p, i) =>
          i === index ? { ...p, value: path as string, valueType: "file" as const } : p,
        );
        onChange(updated);
      }
    } catch {
      // dialog cancelled
    }
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2 px-1 text-xs text-(--color-text-muted)">
        <span className="w-5" />
        <span>{t("request.field")}</span>
        <span>{t("request.value")}</span>
        <span className="w-7" />
        <span className="w-7" />
      </div>

      {pairs.map((pair, index) => (
        <div
          key={pair.id}
          className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2 px-1"
        >
          <input
            type="checkbox"
            checked={pair.enabled}
            onChange={(e) => update(index, "enabled", e.target.checked)}
            className="h-4 w-4 accent-blue-500"
          />
          <input
            type="text"
            value={pair.key}
            onChange={(e) => update(index, "key", e.target.value)}
            placeholder={t("request.field")}
            className="rounded bg-(--color-elevated) px-2 py-1 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={pair.value}
              onChange={(e) => {
                const updated = pairs.map((p, i) =>
                  i === index ? { ...p, value: e.target.value, valueType: undefined } : p,
                );
                onChange(updated);
              }}
              placeholder={pair.valueType === "file" ? t("request.filePath") : t("request.value")}
              className={`min-w-0 flex-1 rounded bg-(--color-elevated) px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${
                pair.valueType === "file"
                  ? "text-violet-400 placeholder-violet-400/50"
                  : "text-(--color-text-primary) placeholder-(--color-text-dimmed)"
              }`}
            />
            <button
              onClick={() => pickFile(index)}
              className={`shrink-0 rounded p-1 transition-colors ${
                pair.valueType === "file"
                  ? "bg-violet-500/20 text-violet-400"
                  : "text-(--color-text-muted) hover:bg-(--color-border) hover:text-(--color-text-primary)"
              }`}
              title={t("request.embedFileContent")}
            >
              <FileUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => removeRow(index)}
            className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-border) hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={addRow}
        className="flex items-center gap-1 px-1 pt-1 text-xs text-(--color-text-muted) hover:text-(--color-text-primary)"
      >
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

function ScriptsEditor({
  preRequestScript,
  postResponseScript,
  onPreRequestChange,
  onPostResponseChange,
}: {
  preRequestScript: string | null;
  postResponseScript: string | null;
  onPreRequestChange: (script: string | null) => void;
  onPostResponseChange: (script: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
          {t("request.preRequest")}
        </label>
        <p className="mb-2 text-xs text-(--color-text-dimmed)">
          Runs before the request is sent. Use <code className="rounded bg-(--color-elevated) px-1">ark.env.set()</code>, <code className="rounded bg-(--color-elevated) px-1">ark.request.setHeader()</code>, etc.
        </p>
        <CodeEditor
          value={preRequestScript ?? ""}
          onChange={(v) => onPreRequestChange(v || null)}
          language="javascript"
          height="150px"
          placeholder="// ark.env.set('token', 'abc123');"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
          {t("request.postResponse")}
        </label>
        <p className="mb-2 text-xs text-(--color-text-dimmed)">
          Runs after the response is received. Access response via <code className="rounded bg-(--color-elevated) px-1">ark.response.json()</code>, <code className="rounded bg-(--color-elevated) px-1">ark.response.status</code>, etc.
        </p>
        <CodeEditor
          value={postResponseScript ?? ""}
          onChange={(v) => onPostResponseChange(v || null)}
          language="javascript"
          height="150px"
          placeholder="// const body = ark.response.json();"
        />
      </div>
    </div>
  );
}

function TestsEditor({
  assertions,
  testScript,
  onAssertionsChange,
  onTestScriptChange,
}: {
  assertions: string | null;
  testScript: string | null;
  onAssertionsChange: (assertions: string | null) => void;
  onTestScriptChange: (script: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
          {t("request.assertions")}
        </label>
        <p className="mb-2 text-xs text-(--color-text-dimmed)">
          Declarative checks. E.g. <code className="rounded bg-(--color-elevated) px-1">status: 200</code>, <code className="rounded bg-(--color-elevated) px-1">{"body.id: { type: string }"}</code>
        </p>
        <CodeEditor
          value={assertions ?? ""}
          onChange={(v) => onAssertionsChange(v || null)}
          language="yaml"
          height="130px"
          placeholder="status: 200"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
          {t("request.testScript")}
        </label>
        <p className="mb-2 text-xs text-(--color-text-dimmed)">
          Write tests using <code className="rounded bg-(--color-elevated) px-1">ark.test()</code> and <code className="rounded bg-(--color-elevated) px-1">ark.expect()</code>.
        </p>
        <CodeEditor
          value={testScript ?? ""}
          onChange={(v) => onTestScriptChange(v || null)}
          language="javascript"
          height="150px"
          placeholder='ark.test("status is 200", function() { ... });'
        />
      </div>
    </div>
  );
}

let kvCounter2 = 0;
const kvId2 = () => `kv_h_${Date.now()}_${++kvCounter2}`;

/** Convert KeyValuePairs → bulk text (disabled lines prefixed with #) */
function pairsToBulkText(pairs: KeyValuePair[]): string {
  return pairs
    .filter((p) => p.key)
    .map((p) => `${p.enabled ? "" : "#"}${p.key}: ${p.value}`)
    .join("\n");
}

/** Parse bulk text → KeyValuePairs */
function bulkTextToPairs(text: string, existingPairs: KeyValuePair[]): KeyValuePair[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const results: KeyValuePair[] = lines.map((line) => {
    const disabled = line.startsWith("#");
    const clean = disabled ? line.slice(1).trim() : line.trim();
    const colonIdx = clean.indexOf(":");
    const key = colonIdx >= 0 ? clean.slice(0, colonIdx).trim() : clean.trim();
    const value = colonIdx >= 0 ? clean.slice(colonIdx + 1).trim() : "";
    // Reuse existing id if key matches
    const existing = existingPairs.find((p) => p.key === key);
    return { id: existing?.id ?? kvId2(), key, value, enabled: !disabled };
  });
  // Always keep a blank row at end
  return results.length > 0 ? results : [{ id: kvId2(), key: "", value: "", enabled: true }];
}

function HeadersEditor({
  headers,
  onChange,
}: {
  headers: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
}) {
  const { t } = useTranslation();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Sync bulk text when switching to bulk mode
  const enterBulk = () => {
    setBulkText(pairsToBulkText(headers));
    setBulkMode(true);
  };

  const exitBulk = () => {
    onChange(bulkTextToPairs(bulkText, headers));
    setBulkMode(false);
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <button
          onClick={bulkMode ? exitBulk : enterBulk}
          title={bulkMode ? "Switch to key-value view" : "Bulk edit"}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-(--color-text-muted) hover:bg-(--color-elevated) hover:text-(--color-text-primary) transition-colors"
        >
          {bulkMode ? (
            <><LayoutList className="h-3.5 w-3.5" /> Key-Value</>
          ) : (
            <><AlignJustify className="h-3.5 w-3.5" /> Bulk Edit</>
          )}
        </button>
      </div>

      {bulkMode ? (
        <div className="space-y-1">
          <p className="text-xs text-(--color-text-dimmed)">
            One header per line: <code className="rounded bg-(--color-elevated) px-1">Key: Value</code>. Prefix with <code className="rounded bg-(--color-elevated) px-1">#</code> to disable.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder={"Content-Type: application/json\nAuthorization: Bearer token\n# X-Disabled-Header: value"}
            className="w-full rounded bg-(--color-elevated) px-3 py-2 font-mono text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>
      ) : (
        <KeyValueEditor
          pairs={headers}
          onChange={onChange}
          keyPlaceholder="Header"
          valuePlaceholder={t("request.value")}
        />
      )}
    </div>
  );
}

function BodyEditor({
  body,
  onChange,
  onCmdEnter,
}: {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
  onCmdEnter?: () => void;
}) {
  const { t } = useTranslation();

  const handleBeautify = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(body.content), null, 2);
      onChange({ ...body, content: formatted });
    } catch {
      // invalid JSON — do nothing
    }
  };

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Body type selector */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex gap-2">
          {BODY_TYPE_IDS.map((btId) => (
            <button
              key={btId}
              onClick={() => onChange({ ...body, type: btId })}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                body.type === btId
                  ? "bg-blue-600 text-white"
                  : "bg-(--color-elevated) text-(--color-text-secondary) hover:text-(--color-text-primary)"
              }`}
            >
              {t(BODY_TYPE_LABEL_KEYS[btId])}
            </button>
          ))}
        </div>
        {body.type === "json" && (
          <button
            onClick={handleBeautify}
            title="Beautify JSON"
            className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-(--color-text-muted) hover:bg-(--color-elevated) hover:text-(--color-text-primary) transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Beautify
          </button>
        )}
      </div>

      {/* Body content */}
      {body.type !== "none" && body.type !== "form-data" && body.type !== "urlencoded" && (
        <div className="min-h-0 flex-1">
          <CodeEditor
            value={body.content}
            onChange={(v) => onChange({ ...body, content: v })}
            language={body.type === "json" ? "json" : body.type === "xml" ? "xml" : "plaintext"}
            height="100%"
            placeholder={body.type === "json" ? '{\n  "key": "value"\n}' : ""}
            onCmdEnter={onCmdEnter}
          />
        </div>
      )}

      {body.type === "urlencoded" && (
        <KeyValueEditor
          pairs={body.formData.length > 0 ? body.formData : [{ id: `kv_formdata_${Date.now()}`, key: "", value: "", enabled: true }]}
          onChange={(formData) => onChange({ ...body, formData })}
          keyPlaceholder="Field"
          valuePlaceholder={t("request.value")}
        />
      )}

      {body.type === "form-data" && (
        <FormDataEditor
          pairs={body.formData.length > 0 ? body.formData : [{ id: `kv_formdata_${Date.now()}`, key: "", value: "", enabled: true }]}
          onChange={(formData) => onChange({ ...body, formData })}
        />
      )}
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-blue-500";
const SELECT_CLASS =
  "rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) outline-none focus:ring-1 focus:ring-blue-500";

/** Labeled wrapper: renders a visible title inline to the left of the field, e.g. "Username: ____". */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-(--color-text-secondary)">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

/** Password input with a show/hide toggle. */
function PasswordInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        className={`${className ?? INPUT_CLASS} pr-8`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-(--color-text-primary)"
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/** Fields that can be cached across auth type switches, keyed by field name. */
type AuthFieldCache = Record<string, string | boolean | undefined>;

function AuthEditor({
  auth,
  onChange,
}: {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}) {
  const { t } = useTranslation();
  // Remembers every field value ever entered, across all auth types, so switching
  // the auth type (and switching back) doesn't lose previously entered data.
  const cacheRef = useRef<AuthFieldCache>({ ...auth } as AuthFieldCache);

  const handleChange = useCallback(
    (next: AuthConfig) => {
      cacheRef.current = { ...cacheRef.current, ...(next as unknown as AuthFieldCache) };
      onChange(next);
    },
    [onChange]
  );

  const cached = (key: string, fallback: string) =>
    (cacheRef.current[key] as string | undefined) ?? fallback;

  return (
    <div className="space-y-3">
      {/* Auth type selector */}
      <select
        value={auth.type}
        onChange={(e) => {
          const type = e.target.value as AuthConfig["type"];
          const c = cacheRef.current;
          switch (type) {
            case "none":
              handleChange({ type: "none" });
              break;
            case "bearer":
              handleChange({ type: "bearer", token: cached("token", "") });
              break;
            case "basic":
              handleChange({
                type: "basic",
                username: cached("username", ""),
                password: cached("password", ""),
              });
              break;
            case "api-key":
              handleChange({
                type: "api-key",
                key: cached("key", ""),
                value: cached("value", ""),
                addTo: (c.addTo as "header" | "query" | undefined) ?? "header",
              });
              break;
            case "oauth2":
              handleChange({
                type: "oauth2",
                grantType: (c.grantType as OAuth2GrantType | undefined) ?? "authorization_code",
                authUrl: cached("authUrl", ""),
                tokenUrl: cached("tokenUrl", ""),
                clientId: cached("clientId", ""),
                clientSecret: cached("clientSecret", ""),
                scope: cached("scope", ""),
                callbackUrl: cached("callbackUrl", "http://localhost:9876/callback"),
                username: cached("username", ""),
                password: cached("password", ""),
                usePkce: (c.usePkce as boolean | undefined) ?? true,
              });
              break;
            case "digest":
              handleChange({
                type: "digest",
                username: cached("username", ""),
                password: cached("password", ""),
              });
              break;
            case "aws-v4":
              handleChange({
                type: "aws-v4",
                accessKey: cached("accessKey", ""),
                secretKey: cached("secretKey", ""),
                region: cached("region", ""),
                service: cached("service", ""),
                sessionToken: cached("sessionToken", ""),
              });
              break;
            case "jwt-bearer":
              handleChange({
                type: "jwt-bearer",
                secret: cached("secret", ""),
                algorithm: cached("algorithm", "HS256"),
                payload: cached("payload", '{\n  "sub": "1234567890",\n  "iat": 0\n}'),
                headerPrefix: cached("headerPrefix", "Bearer"),
              });
              break;
            case "ntlm":
              handleChange({
                type: "ntlm",
                username: cached("username", ""),
                password: cached("password", ""),
                domain: cached("domain", ""),
                workstation: cached("workstation", ""),
              });
              break;
            case "saml":
              handleChange({
                type: "saml",
                idpUrl: cached("idpUrl", ""),
                entityId: cached("entityId", ""),
                assertionConsumerUrl: cached("assertionConsumerUrl", ""),
                certificate: cached("certificate", ""),
                nameIdFormat: cached(
                  "nameIdFormat",
                  "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
                ),
                samlToken: cached("samlToken", ""),
              });
              break;
          }
        }}
        className={SELECT_CLASS}
      >
        <option value="none">{t("auth.none")}</option>
        <option value="bearer">{t("auth.bearer")}</option>
        <option value="basic">{t("auth.basic")}</option>
        <option value="api-key">{t("auth.apiKey")}</option>
        <option value="oauth2">{t("auth.oauth2")}</option>
        <option value="digest">{t("auth.digest")}</option>
        <option value="aws-v4">{t("auth.awsV4")}</option>
        <option value="jwt-bearer">{t("auth.jwtBearer")}</option>
        <option value="ntlm">{t("auth.ntlm")}</option>
        <option value="saml">{t("auth.saml")}</option>
      </select>

      {/* Auth fields */}
      {auth.type === "bearer" && (
        <Field label={t("auth.token")}>
          <input
            type="text"
            value={auth.token}
            onChange={(e) => handleChange({ ...auth, token: e.target.value })}
            placeholder={t("auth.token")}
            className={INPUT_CLASS}
          />
        </Field>
      )}

      {auth.type === "basic" && (
        <div className="space-y-2">
          <Field label={t("auth.username")}>
            <input
              type="text"
              value={auth.username}
              onChange={(e) => handleChange({ ...auth, username: e.target.value })}
              placeholder={t("auth.username")}
              className={INPUT_CLASS}
              autoComplete="username"
            />
          </Field>
          <Field label={t("auth.password")}>
            <PasswordInput
              value={auth.password}
              onChange={(e) => handleChange({ ...auth, password: e.target.value })}
              placeholder={t("auth.password")}
            />
          </Field>
        </div>
      )}

      {auth.type === "api-key" && (
        <div className="space-y-2">
          <Field label="Key">
            <input
              type="text"
              value={auth.key}
              onChange={(e) => handleChange({ ...auth, key: e.target.value })}
              placeholder="Key name (e.g. X-API-Key)"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={t("request.value")}>
            <input
              type="text"
              value={auth.value}
              onChange={(e) => handleChange({ ...auth, value: e.target.value })}
              placeholder={t("request.value")}
              className={INPUT_CLASS}
            />
          </Field>
          <select
            value={auth.addTo}
            onChange={(e) =>
              handleChange({ ...auth, addTo: e.target.value as "header" | "query" })
            }
            className={SELECT_CLASS}
          >
            <option value="header">{t("auth.addToHeader")}</option>
            <option value="query">{t("auth.addToQuery")}</option>
          </select>
        </div>
      )}

      {auth.type === "oauth2" && (
        <OAuth2Editor auth={auth} onChange={handleChange} />
      )}

      {auth.type === "digest" && (
        <div className="space-y-2">
          <Field label={t("auth.username")}>
            <input
              type="text"
              value={auth.username}
              onChange={(e) => handleChange({ ...auth, username: e.target.value })}
              placeholder={t("auth.username")}
              className={INPUT_CLASS}
              autoComplete="username"
            />
          </Field>
          <Field label={t("auth.password")}>
            <PasswordInput
              value={auth.password}
              onChange={(e) => handleChange({ ...auth, password: e.target.value })}
              placeholder={t("auth.password")}
            />
          </Field>
        </div>
      )}

      {auth.type === "aws-v4" && (
        <div className="space-y-2">
          <Field label={t("auth.accessKey")}>
            <input
              type="text"
              value={auth.accessKey}
              onChange={(e) => handleChange({ ...auth, accessKey: e.target.value })}
              placeholder={t("auth.accessKey")}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={t("auth.secretKey")}>
            <PasswordInput
              value={auth.secretKey}
              onChange={(e) => handleChange({ ...auth, secretKey: e.target.value })}
              placeholder={t("auth.secretKey")}
            />
          </Field>
          <Field label={t("auth.region")}>
            <input
              type="text"
              value={auth.region}
              onChange={(e) => handleChange({ ...auth, region: e.target.value })}
              placeholder={t("auth.region")}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={t("auth.service")}>
            <input
              type="text"
              value={auth.service}
              onChange={(e) => handleChange({ ...auth, service: e.target.value })}
              placeholder={t("auth.service")}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={t("auth.sessionToken")}>
            <input
              type="text"
              value={auth.sessionToken}
              onChange={(e) => handleChange({ ...auth, sessionToken: e.target.value })}
              placeholder={t("auth.sessionToken")}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      )}

      {auth.type === "jwt-bearer" && (
        <div className="space-y-2">
          <select
            value={auth.algorithm}
            onChange={(e) => handleChange({ ...auth, algorithm: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="HS256">HS256</option>
            <option value="HS384">HS384</option>
            <option value="HS512">HS512</option>
            <option value="RS256">RS256</option>
            <option value="RS384">RS384</option>
            <option value="RS512">RS512</option>
            <option value="ES256">ES256</option>
            <option value="ES384">ES384</option>
          </select>
          <Field label={auth.algorithm.startsWith("HS") ? "HMAC Secret" : "Private Key (PEM)"}>
            <PasswordInput
              value={auth.secret}
              onChange={(e) => handleChange({ ...auth, secret: e.target.value })}
              placeholder={auth.algorithm.startsWith("HS") ? "HMAC Secret" : "Private Key (PEM)"}
            />
          </Field>
          <textarea
            value={auth.payload}
            onChange={(e) => handleChange({ ...auth, payload: e.target.value })}
            placeholder='{"sub": "user", "iat": 0}'
            rows={5}
            className={INPUT_CLASS + " resize-y font-mono"}
          />
          <Field label={t("auth.headerPrefix")}>
            <input
              type="text"
              value={auth.headerPrefix}
              onChange={(e) => handleChange({ ...auth, headerPrefix: e.target.value })}
              placeholder={t("auth.headerPrefix")}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      )}

      {auth.type === "ntlm" && (
        <div className="space-y-2">
          <Field label={t("auth.username")}>
            <input
              type="text"
              value={auth.username}
              onChange={(e) => handleChange({ ...auth, username: e.target.value })}
              placeholder={t("auth.username")}
              className={INPUT_CLASS}
              autoComplete="username"
            />
          </Field>
          <Field label={t("auth.password")}>
            <PasswordInput
              value={auth.password}
              onChange={(e) => handleChange({ ...auth, password: e.target.value })}
              placeholder={t("auth.password")}
            />
          </Field>
          <Field label={t("auth.domain")}>
            <input
              type="text"
              value={auth.domain}
              onChange={(e) => handleChange({ ...auth, domain: e.target.value })}
              placeholder={t("auth.domain")}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={t("auth.workstation")}>
            <input
              type="text"
              value={auth.workstation}
              onChange={(e) => handleChange({ ...auth, workstation: e.target.value })}
              placeholder={t("auth.workstation")}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      )}

      {auth.type === "saml" && (
        <div className="space-y-2">
          <Field label={t("auth.idpUrl")}>
            <input
              type="text"
              value={auth.idpUrl}
              onChange={(e) => handleChange({ ...auth, idpUrl: e.target.value })}
              placeholder={t("auth.idpUrl")}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={t("auth.entityId")}>
            <input
              type="text"
              value={auth.entityId}
              onChange={(e) => handleChange({ ...auth, entityId: e.target.value })}
              placeholder={t("auth.entityId")}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={t("auth.assertionConsumerUrl")}>
            <input
              type="text"
              value={auth.assertionConsumerUrl}
              onChange={(e) => handleChange({ ...auth, assertionConsumerUrl: e.target.value })}
              placeholder={t("auth.assertionConsumerUrl")}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={t("auth.certificate")}>
            <textarea
              value={auth.certificate}
              onChange={(e) => handleChange({ ...auth, certificate: e.target.value })}
              placeholder={t("auth.certificate")}
              rows={3}
              className={INPUT_CLASS + " resize-y font-mono"}
            />
          </Field>
          <Field label={t("auth.nameIdFormat")}>
            <input
              type="text"
              value={auth.nameIdFormat}
              onChange={(e) => handleChange({ ...auth, nameIdFormat: e.target.value })}
              placeholder={t("auth.nameIdFormat")}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={t("auth.samlToken")}>
            <input
              type="text"
              value={auth.samlToken}
              onChange={(e) => handleChange({ ...auth, samlToken: e.target.value })}
              placeholder={t("auth.samlToken")}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function OAuth2Editor({
  auth,
  onChange,
}: {
  auth: Extract<AuthConfig, { type: "oauth2" }>;
  onChange: (auth: AuthConfig) => void;
}) {
  const { t } = useTranslation();
  const [tokenStatus, setTokenStatus] = useState<OAuthTokenStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `${auth.clientId}:${auth.authUrl}`;

  const refreshStatus = useCallback(async () => {
    if (!auth.clientId) return;
    try {
      const status = await oauthGetTokenStatus(cacheKey);
      setTokenStatus(status);
    } catch {
      // ignore - no token yet
    }
  }, [cacheKey, auth.clientId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleGetToken = async () => {
    setLoading(true);
    setError(null);
    try {
      await oauthStartFlow(auth);
      await refreshStatus();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message: string }).message
        : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClearToken = async () => {
    try {
      await oauthClearToken(cacheKey);
      setTokenStatus(null);
    } catch {
      // ignore
    }
  };

  const showAuthUrl =
    auth.grantType === "authorization_code" || auth.grantType === "implicit";
  const showTokenUrl = auth.grantType !== "implicit";
  const showPassword = auth.grantType === "password";
  const showPkce = auth.grantType === "authorization_code";

  return (
    <div className="space-y-2">
      {/* Grant Type */}
      <label className="block">
        <span className="text-xs text-(--color-text-secondary)">{t("auth.grantType")}</span>
        <select
          value={auth.grantType}
          onChange={(e) =>
            onChange({ ...auth, grantType: e.target.value as OAuth2GrantType })
          }
          className={SELECT_CLASS + " w-full"}
        >
          <option value="authorization_code">{t("auth.authorizationCode")}</option>
          <option value="client_credentials">{t("auth.clientCredentials")}</option>
          <option value="implicit">{t("auth.implicit")}</option>
          <option value="password">{t("auth.passwordGrant")}</option>
        </select>
      </label>

      {/* Auth URL */}
      {showAuthUrl && (
        <label className="block">
          <span className="text-xs text-(--color-text-secondary)">{t("auth.authUrl")}</span>
          <input
            type="text"
            value={auth.authUrl}
            onChange={(e) => onChange({ ...auth, authUrl: e.target.value })}
            placeholder="https://provider.com/oauth/authorize"
            className={INPUT_CLASS}
          />
        </label>
      )}

      {/* Token URL */}
      {showTokenUrl && (
        <label className="block">
          <span className="text-xs text-(--color-text-secondary)">{t("auth.tokenUrl")}</span>
          <input
            type="text"
            value={auth.tokenUrl}
            onChange={(e) => onChange({ ...auth, tokenUrl: e.target.value })}
            placeholder="https://provider.com/oauth/token"
            className={INPUT_CLASS}
          />
        </label>
      )}

      {/* Client ID & Secret */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-(--color-text-secondary)">{t("auth.clientId")}</span>
          <input
            type="text"
            value={auth.clientId}
            onChange={(e) => onChange({ ...auth, clientId: e.target.value })}
            placeholder={t("auth.clientId")}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className="text-xs text-(--color-text-secondary)">{t("auth.clientSecret")}</span>
          <PasswordInput
            value={auth.clientSecret}
            onChange={(e) => onChange({ ...auth, clientSecret: e.target.value })}
            placeholder={t("auth.clientSecret")}
          />
        </label>
      </div>

      {/* Scope */}
      <label className="block">
        <span className="text-xs text-(--color-text-secondary)">{t("auth.scope")}</span>
        <input
          type="text"
          value={auth.scope}
          onChange={(e) => onChange({ ...auth, scope: e.target.value })}
          placeholder="openid profile email"
          className={INPUT_CLASS}
        />
      </label>

      {/* Username & Password (password grant only) */}
      {showPassword && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-(--color-text-secondary)">{t("auth.username")}</span>
            <input
              type="text"
              value={auth.username}
              onChange={(e) => onChange({ ...auth, username: e.target.value })}
              placeholder={t("auth.username")}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-xs text-(--color-text-secondary)">{t("auth.password")}</span>
            <PasswordInput
              value={auth.password}
              onChange={(e) => onChange({ ...auth, password: e.target.value })}
              placeholder={t("auth.password")}
            />
          </label>
        </div>
      )}

      {/* Callback URL */}
      {showAuthUrl && (
        <label className="block">
          <span className="text-xs text-(--color-text-secondary)">{t("auth.callbackUrl")}</span>
          <input
            type="text"
            value={auth.callbackUrl}
            onChange={(e) => onChange({ ...auth, callbackUrl: e.target.value })}
            placeholder="http://localhost:9876/callback"
            className={INPUT_CLASS}
          />
        </label>
      )}

      {/* PKCE */}
      {showPkce && (
        <label className="flex items-center gap-2 text-sm text-(--color-text-primary)">
          <input
            type="checkbox"
            checked={auth.usePkce}
            onChange={(e) => onChange({ ...auth, usePkce: e.target.checked })}
            className="rounded"
          />
          {t("auth.usePkce")}
        </label>
      )}

      {/* Token Status & Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleGetToken}
          disabled={loading}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t("auth.authenticating") : t("auth.getToken")}
        </button>
        {tokenStatus?.hasToken && (
          <button
            onClick={handleClearToken}
            className="rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary)"
          >
            {t("auth.clearToken")}
          </button>
        )}
      </div>

      {/* Token status display */}
      {tokenStatus?.hasToken && (
        <div
          className={`rounded px-3 py-1.5 text-xs ${
            tokenStatus.isExpired
              ? "bg-red-500/10 text-red-400"
              : "bg-green-500/10 text-green-400"
          }`}
        >
          {tokenStatus.isExpired
            ? t("auth.tokenExpired")
            : tokenStatus.expiresAt
              ? `${t("auth.tokenValid")} (expires ${new Date(tokenStatus.expiresAt * 1000).toLocaleTimeString()})`
              : `${t("auth.tokenValid")} (no expiry)`}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
