import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { KeyValueEditor } from "./key-value-editor";
import type { AuthConfig, BodyType, RequestBody, KeyValuePair, OAuth2GrantType, OAuthTokenStatus } from "@apiark/types";
import { oauthStartFlow, oauthGetTokenStatus, oauthClearToken } from "@/lib/tauri-api";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { CodeEditor } from "@/components/ui/code-editor";
import { Plus, Trash2, FileUp, Wand2, AlignJustify, LayoutList, Eye, EyeOff, BookOpen, Sparkles, ChevronDown } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<Tab>("params");
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

  // Default to the "body" tab if the request has a body, otherwise "params",
  // whenever the user opens/switches to a different request.
  useEffect(() => {
    setActiveTab(tab?.body && tab.body.type !== "none" ? "body" : "params");
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
      <div className={`flex-1 p-3 ${activeTab === "body" || activeTab === "scripts" ? "flex flex-col overflow-hidden" : "overflow-auto"}`}>
        {activeTab === "params" && (
          <div className="relative space-y-4">
            <PathVariablesEditor
              url={tab.url}
              pathVars={pathVars}
              values={pathVariables}
              onChange={setPathVariables}
              onUrlChange={setUrl}
            />
            <ParamsEditor
              params={params}
              onChange={setParams}
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

/** A single insertable code snippet shown in the "Insert snippet" menu. */
interface ScriptSnippet {
  label: string;
  code: string;
}

const PRE_REQUEST_SNIPPETS: ScriptSnippet[] = [
  { label: "Set an environment variable", code: "ark.env.set('token', 'abc123');" },
  { label: "Read an environment variable", code: "const token = ark.env.get('token');" },
  { label: "Set a shared collection variable", code: "ark.collectionVariables.set('apiVersion', 'v2');" },
  { label: "Read a collection variable", code: "const apiVersion = ark.collectionVariables.get('apiVersion');" },
  { label: "Add/override a request header", code: "ark.request.setHeader('Authorization', 'Bearer ' + ark.env.get('token'));" },
  { label: "Change the request URL", code: "ark.request.setUrl(ark.request.url.replace('http://', 'https://'));" },
  { label: "Change the HTTP method", code: "ark.request.setMethod('POST');" },
  { label: "Modify the JSON request body", code: "const body = JSON.parse(ark.request.body || '{}');\nbody.timestamp = Date.now();\nark.request.setBody(JSON.stringify(body));" },
  { label: "Store a value across requests (globals)", code: "ark.globals.set('requestCount', Number(ark.globals.get('requestCount') || 0) + 1);" },
  { label: "Log to the console panel", code: "console.log('Sending request to', ark.request.url);" },
];

const POST_RESPONSE_SNIPPETS: ScriptSnippet[] = [
  { label: "Save a response value to an env variable", code: "const body = ark.response.json();\nark.env.set('userId', body.id);" },
  { label: "Save a response value as a shared collection variable", code: "const body = ark.response.json();\nark.collectionVariables.set('lastOrderId', body.id);" },
  { label: "Log the response", code: "console.log('Status:', ark.response.status, ark.response.body);" },
  { label: "Assert the status code", code: "ark.test('status is 200', function () {\n  ark.expect(ark.response.status).to.equal(200);\n});" },
  { label: "Assert a response body field", code: "ark.test('has an id field', function () {\n  const body = ark.response.json();\n  ark.expect(body).to.have.property('id');\n});" },
  { label: "Read a response header", code: "const contentType = ark.response.headers['content-type'];" },
  { label: "Only run logic on success", code: "if (ark.response.status < 300) {\n  ark.env.set('lastSuccess', 'true');\n}" },
];

/** Dropdown button that inserts a ready-made ark script snippet into the editor. */
function InsertSnippetMenu({
  snippets,
  onInsert,
}: {
  snippets: ScriptSnippet[];
  onInsert: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-(--color-text-muted) hover:bg-(--color-elevated) hover:text-(--color-text-primary) transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Insert example
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          {/* Backdrop to close the menu on outside click */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-80 max-w-[90vw] rounded border border-(--color-border) bg-(--color-surface) py-1 shadow-lg">
            {snippets.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  onInsert(s.code);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-(--color-text-secondary) hover:bg-(--color-elevated) hover:text-(--color-text-primary)"
              >
                <div>{s.label}</div>
                <code className="mt-0.5 block truncate text-(--color-text-dimmed)">{s.code.split("\n")[0]}</code>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Reference entry rendered in the collapsible ark API cheat-sheet. */
interface ApiRefItem {
  code: string;
  desc: string;
}

const ARK_API_GROUPS: { title: string; items: ApiRefItem[] }[] = [
  {
    title: "Variables",
    items: [
      { code: "ark.env.get(key)", desc: "Read a variable — sees collection, environment, and .env variables merged together" },
      { code: "ark.env.set(key, value)", desc: "Set/override a variable for this run (does not edit any file on disk)" },
      { code: "ark.env.unset(key)", desc: "Remove a variable for this run" },
      { code: "ark.globals.get/set/unset(key)", desc: "Same as env, but persists across all requests in .apiark/globals.local.yaml (personal, gitignored)" },
      { code: "ark.collectionVariables.get/set/unset(key)", desc: "Shared, committed variables for this collection — persisted to .apiark/apiark.yaml so teammates see the same values" },
      { code: "ark.variables.get/set/unset(key)", desc: "Same as env, but only for this script run" },
      { code: "Precedence (low → high)", desc: "Collection Variables < root .env < environment variables < secrets < ark.env.set()" },
    ],
  },
  {
    title: "Request (pre-request only)",
    items: [
      { code: "ark.request.url / .method / .headers / .body", desc: "Read the current request" },
      { code: "ark.request.setUrl(url)", desc: "Change the request URL" },
      { code: "ark.request.setMethod(method)", desc: "Change the HTTP method" },
      { code: "ark.request.setHeader(key, value)", desc: "Add or override a header" },
      { code: "ark.request.removeHeader(key)", desc: "Remove a header" },
      { code: "ark.request.setBody(body)", desc: "Replace the request body (string)" },
    ],
  },
  {
    title: "Response (post-response only)",
    items: [
      { code: "ark.response.status / .statusText", desc: "HTTP status code and text" },
      { code: "ark.response.headers", desc: "Response headers object" },
      { code: "ark.response.time / .size", desc: "Response time (ms) and size (bytes)" },
      { code: "ark.response.json()", desc: "Parse the response body as JSON" },
      { code: "ark.response.text()", desc: "Get the raw response body string" },
    ],
  },
  {
    title: "Console & Tests",
    items: [
      { code: "console.log/warn/error/info(...)", desc: "Shown in the request's Console output" },
      { code: "ark.test(name, fn)", desc: "Register a named test; a thrown error marks it failed" },
      { code: "ark.expect(value).to.equal(x)", desc: "Chai-like assertions: .to.be.true, .to.have.property(), .to.include(), .to.match(re), ..." },
    ],
  },
];

/** Collapsible cheat-sheet documenting the full `ark` scripting API. */
function ArkApiReference() {
  return (
    <details className="group shrink-0 rounded border border-(--color-border) bg-(--color-elevated)/40 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 font-medium text-(--color-text-secondary) hover:text-(--color-text-primary)">
        <BookOpen className="h-3.5 w-3.5" />
        ark scripting API reference
        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        <span className="ml-auto font-normal text-(--color-text-dimmed)">
          Available in Scripts &amp; Tests
        </span>
      </summary>
      <div className="grid gap-3 border-t border-(--color-border) px-3 py-2 sm:grid-cols-2">
        <p className="col-span-full -mt-0.5 mb-0.5 text-(--color-text-dimmed)">
          Tip: define shared <strong className="text-(--color-text-secondary)">Collection Variables</strong> (available to every environment) via the collection&apos;s <strong className="text-(--color-text-secondary)">⚙ Collection Defaults</strong> menu in the sidebar, or set them straight from a script with <code className="rounded bg-(--color-elevated) px-1 text-blue-400">ark.collectionVariables.set(key, value)</code> — changes are saved automatically.
        </p>
        {ARK_API_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-1 font-semibold text-(--color-text-secondary)">{group.title}</div>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.code}>
                  <code className="rounded bg-(--color-elevated) px-1 py-0.5 text-blue-400">{item.code}</code>
                  <span className="ml-1.5 text-(--color-text-dimmed)">{item.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
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

  const insertInto = (
    current: string | null,
    onChange: (script: string | null) => void,
    code: string,
  ) => {
    onChange(current ? `${current}\n${code}` : code);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <ArkApiReference />

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-(--color-text-secondary)">
            {t("request.preRequest")}
          </label>
          <InsertSnippetMenu
            snippets={PRE_REQUEST_SNIPPETS}
            onInsert={(code) => insertInto(preRequestScript, onPreRequestChange, code)}
          />
        </div>
        <p className="text-xs text-(--color-text-dimmed)">
          Runs before the request is sent. Use <code className="rounded bg-(--color-elevated) px-1">ark.env.set()</code>, <code className="rounded bg-(--color-elevated) px-1">ark.request.setHeader()</code>, etc.
        </p>
        <div className="min-h-0 flex-1">
          <CodeEditor
            value={preRequestScript ?? ""}
            onChange={(v) => onPreRequestChange(v || null)}
            language="javascript"
            height="100%"
            placeholder={"// e.g. attach an auth token from the environment:\nark.request.setHeader('Authorization', 'Bearer ' + ark.env.get('token'));"}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-(--color-text-secondary)">
            {t("request.postResponse")}
          </label>
          <InsertSnippetMenu
            snippets={POST_RESPONSE_SNIPPETS}
            onInsert={(code) => insertInto(postResponseScript, onPostResponseChange, code)}
          />
        </div>
        <p className="text-xs text-(--color-text-dimmed)">
          Runs after the response is received. Access response via <code className="rounded bg-(--color-elevated) px-1">ark.response.json()</code>, <code className="rounded bg-(--color-elevated) px-1">ark.response.status</code>, etc.
        </p>
        <div className="min-h-0 flex-1">
          <CodeEditor
            value={postResponseScript ?? ""}
            onChange={(v) => onPostResponseChange(v || null)}
            language="javascript"
            height="100%"
            placeholder={"// e.g. save an id from the response for later requests:\nconst body = ark.response.json();\nark.env.set('userId', body.id);"}
          />
        </div>
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
function pairsToBulkText(pairs: KeyValuePair[], separator = ":"): string {
  return pairs
    .filter((p) => p.key)
    .map((p) => `${p.enabled ? "" : "#"}${p.key}${separator} ${p.value}`)
    .join("\n");
}

/** Parse bulk text → KeyValuePairs */
function bulkTextToPairs(text: string, existingPairs: KeyValuePair[], separator = ":"): KeyValuePair[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const results: KeyValuePair[] = lines.map((line) => {
    const disabled = line.startsWith("#");
    const clean = disabled ? line.slice(1).trim() : line.trim();
    const sepIdx = clean.indexOf(separator);
    const key = sepIdx >= 0 ? clean.slice(0, sepIdx).trim() : clean.trim();
    const value = sepIdx >= 0 ? clean.slice(sepIdx + separator.length).trim() : "";
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

function ParamsEditor({
  params,
  onChange,
}: {
  params: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
}) {
  const { t } = useTranslation();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Sync bulk text when switching to bulk mode
  const enterBulk = () => {
    setBulkText(pairsToBulkText(params, "="));
    setBulkMode(true);
  };

  const exitBulk = () => {
    onChange(bulkTextToPairs(bulkText, params, "="));
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
            One param per line: <code className="rounded bg-(--color-elevated) px-1">key=value</code>. Prefix with <code className="rounded bg-(--color-elevated) px-1">#</code> to disable.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder={"page=1\nlimit=20\n# disabledParam=value"}
            className="w-full rounded bg-(--color-elevated) px-3 py-2 font-mono text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>
      ) : (
        <KeyValueEditor
          pairs={params}
          onChange={onChange}
          keyPlaceholder="Parameter"
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

  // Stable id for the placeholder empty row shown when formData is empty.
  // Must NOT be regenerated on every render (e.g. via `Date.now()` inline),
  // otherwise its React `key` changes on every re-render (including ones
  // unrelated to this row, like switching sub-tabs and back), which forces
  // React to unmount/remount the input — dropping focus and any in-flight
  // keystrokes, making it look like the user's input "disappeared".
  // Uses a lazy useState initializer (runs once on mount only) instead of a
  // ref, since reading ref values during render is not allowed here.
  const [emptyFormDataId] = useState(() => `kv_formdata_${Date.now()}`);

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
          pairs={body.formData.length > 0 ? body.formData : [{ id: emptyFormDataId, key: "", value: "", enabled: true }]}
          onChange={(formData) => onChange({ ...body, formData })}
          keyPlaceholder="Field"
          valuePlaceholder={t("request.value")}
        />
      )}

      {body.type === "form-data" && (
        <FormDataEditor
          pairs={body.formData.length > 0 ? body.formData : [{ id: emptyFormDataId, key: "", value: "", enabled: true }]}
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
