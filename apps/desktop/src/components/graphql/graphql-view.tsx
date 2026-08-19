import { useState, useRef, useEffect } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { KeyValueEditor } from "@/components/request/key-value-editor";
import { ResponsePanel } from "@/components/response/response-panel";
import { CodeEditor } from "@/components/ui/code-editor";
import {
  Download,
  Plug,
  Unplug,
  Trash2,
  ArrowDown,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import type { AuthConfig } from "@apiark/types";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { UrlBar } from "@/components/request/url-bar";
import {
  useGraphQLSubscription,
  type GqlSubscriptionMessage,
} from "@/hooks/use-graphql-subscription";

type GqlTab = "query" | "variables" | "headers" | "auth";

const INTROSPECTION_QUERY = `query IntrospectionQuery {
  __schema {
    types {
      name
      kind
      description
      fields(includeDeprecated: false) {
        name
        type { name kind ofType { name kind } }
      }
    }
    queryType { name }
    mutationType { name }
    subscriptionType { name }
  }
}`;

function isSubscriptionQuery(query: string): boolean {
  // Strip comments and find the first operation keyword
  const stripped = query
    .replace(/#[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return /^\s*subscription\b/i.test(stripped);
}

export function GraphQLView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<GqlTab>("query");
  const [schemaTypes, setSchemaTypes] = useState<
    { name: string; kind: string }[]
  >([]);
  const [fetchingSchema, setFetchingSchema] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const tab = useActiveTab();
  const {
    setHeaders,
    setAuth,
    setGraphQLQuery,
    setGraphQLVariables,
    setGraphQLOperationName,
    setGraphQLSchema,
    send,
  } = useTabStore();

  const connectionId = tab ? `gql-sub-${tab.id}` : "";
  const {
    status: subStatus,
    messages: subMessages,
    error: subError,
    subscribe,
    unsubscribe,
    clearMessages,
  } = useGraphQLSubscription(connectionId);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [subMessages, autoScroll]);

  if (!tab || !tab.graphql) return null;

  const isSubscription = isSubscriptionQuery(tab.graphql.query);

  const handleFetchSchema = async () => {
    if (!tab.url.trim()) return;
    setFetchingSchema(true);
    const originalQuery = tab.graphql!.query;
    setGraphQLQuery(INTROSPECTION_QUERY);
    setGraphQLOperationName("IntrospectionQuery");
    await send();
    setGraphQLQuery(originalQuery);
    setGraphQLOperationName(tab.graphql!.operationName);

    const updated = useTabStore
      .getState()
      .tabs.find((t) => t.id === tab.id);
    if (updated?.response?.body) {
      try {
        const data = JSON.parse(updated.response.body);
        const types =
          data?.data?.__schema?.types?.filter(
            (t: { name: string }) => !t.name.startsWith("__"),
          ) ?? [];
        setSchemaTypes(types);
        setGraphQLSchema(updated.response.body);
      } catch {
        setSchemaTypes([]);
      }
    }
    setFetchingSchema(false);
  };

  const handleSubscribe = () => {
    if (subStatus === "subscribed" || subStatus === "connected") {
      unsubscribe();
    } else {
      const headers = tab.headers.filter(
        (h) => h.key.trim() && h.enabled,
      );
      subscribe(
        tab.url,
        tab.graphql!.query,
        tab.graphql!.variables,
        tab.graphql!.operationName,
        headers,
      );
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Breadcrumb />
      <UrlBar
        extraActions={
          <div className="flex items-center gap-1">
            <button
              onClick={handleFetchSchema}
              disabled={fetchingSchema || !tab.url.trim()}
              className="flex items-center gap-1 rounded-lg bg-(--color-elevated) px-2.5 py-2 text-xs text-(--color-text-secondary) hover:bg-(--color-border) disabled:opacity-50"
              title={t("graphql.fetchSchema")}
            >
              <Download className="h-3 w-3" />
              {fetchingSchema
                ? t("graphql.fetchingSchema")
                : t("graphql.schema")}
            </button>
            {isSubscription && (
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    subStatus === "subscribed"
                      ? "bg-green-500"
                      : subStatus === "connecting" || subStatus === "connected"
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-gray-500"
                  }`}
                />
                <span className="text-xs text-(--color-text-muted) capitalize">
                  {subStatus}
                </span>
              </div>
            )}
          </div>
        }
        sendButton={
          isSubscription ? (
            <button
              onClick={handleSubscribe}
              disabled={
                subStatus === "connecting" || !tab.url.trim()
              }
              className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                subStatus === "subscribed" || subStatus === "connected"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {subStatus === "subscribed" || subStatus === "connected" ? (
                <>
                  <Unplug className="h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4" />
                  {subStatus === "connecting"
                    ? "Connecting..."
                    : "Subscribe"}
                </>
              )}
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Query editor */}
        <div className="flex min-h-0 w-1/2 flex-col border-r border-(--color-border)">
          <div className="flex shrink-0 gap-0 border-b border-(--color-border) bg-(--color-surface)">
            {(["query", "variables", "headers", "auth"] as const).map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-4 py-2 text-sm capitalize transition-colors ${
                    activeTab === t
                      ? "border-b-2 border-purple-500 text-(--color-text-primary)"
                      : "text-(--color-text-muted) hover:text-(--color-text-secondary)"
                  }`}
                >
                  {t}
                </button>
              ),
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-3">
            {activeTab === "query" && (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex shrink-0 items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-(--color-text-secondary)">
                      {t("graphql.query")}
                    </label>
                    {isSubscription && (
                      <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-400">
                        SUBSCRIPTION
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={tab.graphql.operationName}
                    onChange={(e) =>
                      setGraphQLOperationName(e.target.value)
                    }
                    placeholder={t("graphql.operationName")}
                    className="rounded bg-(--color-elevated) px-2 py-1 text-xs text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none"
                  />
                </div>
                <div className="min-h-0 flex-1">
                  <CodeEditor
                    value={tab.graphql.query}
                    onChange={(v) => setGraphQLQuery(v)}
                    language="graphql"
                    height="100%"
                    placeholder="subscription { messageAdded { id text } }"
                  />
                </div>
              </div>
            )}

            {activeTab === "variables" && (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <label className="shrink-0 text-xs font-medium text-(--color-text-secondary)">
                  {t("graphql.variablesJson")}
                </label>
                <div className="min-h-0 flex-1">
                  <CodeEditor
                    value={tab.graphql.variables}
                    onChange={(v) => setGraphQLVariables(v)}
                    language="json"
                    height="100%"
                    placeholder='{ "id": "123" }'
                  />
                </div>
              </div>
            )}

            {activeTab === "headers" && (
              <div className="overflow-auto">
                <KeyValueEditor
                  pairs={tab.headers}
                  onChange={setHeaders}
                  keyPlaceholder={t("request.header")}
                  valuePlaceholder={t("request.value")}
                />
              </div>
            )}

            {activeTab === "auth" && (
              <div className="overflow-auto">
                <AuthEditorCompact
                  auth={tab.auth}
                  onChange={setAuth}
                />
              </div>
            )}
          </div>

          {schemaTypes.length > 0 && (
            <div className="max-h-32 overflow-auto border-t border-(--color-border) bg-(--color-surface) px-3 py-2">
              <p className="mb-1 text-xs font-medium text-(--color-text-secondary)">
                Schema Types ({schemaTypes.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {schemaTypes.slice(0, 50).map((t) => (
                  <span
                    key={t.name}
                    className="rounded bg-(--color-elevated) px-1.5 py-0.5 text-[10px] text-(--color-text-muted)"
                    title={t.kind}
                  >
                    {t.name}
                  </span>
                ))}
                {schemaTypes.length > 50 && (
                  <span className="text-[10px] text-(--color-text-dimmed)">
                    +{schemaTypes.length - 50} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Response / Subscription messages */}
        <div className="flex w-1/2 flex-col">
          {isSubscription ? (
            <SubscriptionPanel
              status={subStatus}
              messages={subMessages}
              error={subError}
              autoScroll={autoScroll}
              setAutoScroll={setAutoScroll}
              clearMessages={clearMessages}
              logRef={logRef}
            />
          ) : (
            <ResponsePanel />
          )}
        </div>
      </div>
    </div>
  );
}

function SubscriptionPanel({
  status,
  messages,
  error,
  autoScroll,
  setAutoScroll,
  clearMessages,
  logRef,
}: {
  status: string;
  messages: GqlSubscriptionMessage[];
  error: string | null;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  clearMessages: () => void;
  logRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Error */}
      {error && (
        <div className="border-b border-(--color-border) bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between border-b border-(--color-border) px-3 py-1.5 text-xs text-(--color-text-muted)">
        <div className="flex items-center gap-3">
          {status === "subscribed" ? (
            <span className="flex items-center gap-1.5 text-green-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Listening...
            </span>
          ) : (
            <span>
              {status === "disconnected"
                ? "Write a subscription query and click Subscribe"
                : status}
            </span>
          )}
          <span>Messages: {messages.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="h-3 w-3"
            />
            Auto-scroll
          </label>
          <button
            onClick={clearMessages}
            className="rounded p-1 hover:bg-(--color-elevated)"
            title="Clear messages"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={logRef} className="flex-1 overflow-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-(--color-text-dimmed)">
            {status === "subscribed"
              ? "Waiting for events..."
              : "Subscribe to start receiving events"}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="border-b border-(--color-border) px-3 py-2"
            >
              <div className="mb-1 flex items-center gap-2">
                <ArrowDown className="h-3 w-3 text-purple-500" />
                <span className="text-[10px] text-(--color-text-dimmed)">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
                {msg.errors && (
                  <span className="rounded bg-red-500/15 px-1 py-0.5 text-[10px] text-red-400">
                    error
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs text-(--color-text-primary)">
                {msg.data}
              </pre>
              {msg.errors && (
                <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-red-400">
                  {msg.errors}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const GQL_INPUT_CLASS =
  "w-full rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) placeholder-(--color-text-dimmed) outline-none focus:ring-1 focus:ring-purple-500";

type AuthFieldCache = Record<string, string | undefined>;

function GqlPasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
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
        className={`${GQL_INPUT_CLASS} pr-8`}
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

function AuthEditorCompact({
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

  const handleChange = (next: AuthConfig) => {
    cacheRef.current = { ...cacheRef.current, ...(next as unknown as AuthFieldCache) };
    onChange(next);
  };

  const cached = (key: string, fallback: string) => cacheRef.current[key] ?? fallback;

  return (
    <div className="space-y-3">
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
          }
        }}
        className="rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) outline-none focus:ring-1 focus:ring-purple-500"
      >
        <option value="none">{t("auth.none")}</option>
        <option value="bearer">{t("auth.bearer")}</option>
        <option value="basic">{t("auth.basic")}</option>
        <option value="api-key">{t("auth.apiKey")}</option>
      </select>

      {auth.type === "bearer" && (
        <label className="block">
          <span className="mb-1 block text-xs text-(--color-text-secondary)">{t("auth.token")}</span>
          <input
            type="text"
            value={auth.token}
            onChange={(e) => handleChange({ ...auth, token: e.target.value })}
            placeholder={t("auth.token")}
            className={GQL_INPUT_CLASS}
          />
        </label>
      )}

      {auth.type === "basic" && (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs text-(--color-text-secondary)">{t("auth.username")}</span>
            <input
              type="text"
              value={auth.username}
              onChange={(e) => handleChange({ ...auth, username: e.target.value })}
              placeholder={t("auth.username")}
              className={GQL_INPUT_CLASS}
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-(--color-text-secondary)">{t("auth.password")}</span>
            <GqlPasswordInput
              value={auth.password}
              onChange={(e) => handleChange({ ...auth, password: e.target.value })}
              placeholder={t("auth.password")}
            />
          </label>
        </div>
      )}

      {auth.type === "api-key" && (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs text-(--color-text-secondary)">Key</span>
            <input
              type="text"
              value={auth.key}
              onChange={(e) => handleChange({ ...auth, key: e.target.value })}
              placeholder="Key name (e.g. X-API-Key)"
              className={GQL_INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-(--color-text-secondary)">{t("request.value")}</span>
            <input
              type="text"
              value={auth.value}
              onChange={(e) => handleChange({ ...auth, value: e.target.value })}
              placeholder={t("request.value")}
              className={GQL_INPUT_CLASS}
            />
          </label>
          <select
            value={auth.addTo}
            onChange={(e) => handleChange({ ...auth, addTo: e.target.value as "header" | "query" })}
            className="rounded bg-(--color-elevated) px-3 py-1.5 text-sm text-(--color-text-primary) outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="header">{t("auth.addToHeader")}</option>
            <option value="query">{t("auth.addToQuery")}</option>
          </select>
        </div>
      )}
    </div>
  );
}
