import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEnvironmentStore } from "@/stores/environment-store";
import { loadEnvironments as loadEnvironmentsApi } from "@/lib/tauri-api";

// Mock the Tauri API
vi.mock("@/lib/tauri-api", () => ({
  loadEnvironments: vi.fn().mockResolvedValue([
    { name: "development", variables: { baseUrl: "http://localhost:3000", apiKey: "dev-key" }, secrets: [] },
    { name: "production", variables: { baseUrl: "https://api.prod.com" }, secrets: ["apiKey"] },
  ]),
  getResolvedVariables: vi.fn().mockResolvedValue({
    baseUrl: "http://localhost:3000",
    apiKey: "dev-key",
  }),
  loadRootDotenv: vi.fn().mockResolvedValue({}),
  loadGlobals: vi.fn().mockResolvedValue({}),
  saveGlobals: vi.fn().mockResolvedValue(undefined),
  getCollectionDefaults: vi.fn().mockResolvedValue({ variables: {} }),
  updateCollectionDefaults: vi.fn().mockResolvedValue(undefined),
}));

const mockedLoadEnvironments = vi.mocked(loadEnvironmentsApi);

describe("Environment Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLoadEnvironments.mockResolvedValue([
      { name: "development", variables: { baseUrl: "http://localhost:3000", apiKey: "dev-key" }, secrets: [] },
      { name: "production", variables: { baseUrl: "https://api.prod.com" }, secrets: ["apiKey"] },
    ]);
    useEnvironmentStore.setState({
      environments: [],
      activeEnvironmentName: null,
      activeCollectionPath: null,
      runtimeOverrides: {},
      globals: {},
      collectionVariables: {},
    });
  });

  it("loads environments from collection", async () => {
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    const state = useEnvironmentStore.getState();
    expect(state.environments).toHaveLength(2);
    expect(state.environments[0].name).toBe("development");
    expect(state.environments[1].name).toBe("production");
    expect(state.activeCollectionPath).toBe("/test/collection");
  });

  it("auto-selects first environment", async () => {
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    expect(useEnvironmentStore.getState().activeEnvironmentName).toBe("development");
  });

  it("sets active environment", async () => {
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    useEnvironmentStore.getState().setActiveEnvironment("production");
    expect(useEnvironmentStore.getState().activeEnvironmentName).toBe("production");
  });

  it("applies runtime mutations", () => {
    useEnvironmentStore.getState().applyMutations({
      newVar: "newValue",
      deleteVar: null,
    });
    const overrides = useEnvironmentStore.getState().runtimeOverrides;
    expect(overrides.newVar).toBe("newValue");
  });

  it("resets a stale active environment that no longer exists after reload", async () => {
    // Simulate a leftover selection from a different/previous collection
    // (e.g. one that had an environment named "Collection Variables").
    useEnvironmentStore.setState({ activeEnvironmentName: "Collection Variables" });
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    const state = useEnvironmentStore.getState();
    // Falls back to the first available environment instead of keeping the
    // stale name around, which previously caused
    // "Environment 'Collection Variables' not found" from getResolvedVariables().
    expect(state.activeEnvironmentName).toBe("development");
  });

  it("keeps the active environment selected across reloads when it still exists", async () => {
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    useEnvironmentStore.getState().setActiveEnvironment("production");
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    expect(useEnvironmentStore.getState().activeEnvironmentName).toBe("production");
  });

  it("ignores a stale load that finishes after a newer workspace load", async () => {
    let resolveOld!: (value: unknown) => void;
    const oldLoad = new Promise((resolve) => {
      resolveOld = resolve;
    });

    mockedLoadEnvironments
      .mockImplementationOnce(() => oldLoad as Promise<never>)
      .mockResolvedValueOnce([
        { name: "staging", variables: { baseUrl: "https://staging.example" }, secrets: [] },
      ]);

    const stale = useEnvironmentStore.getState().loadEnvironments("/old/workspace/collection");
    const fresh = useEnvironmentStore.getState().loadEnvironments("/new/workspace/collection");

    await fresh;
    expect(useEnvironmentStore.getState().environments.map((e) => e.name)).toEqual(["staging"]);
    expect(useEnvironmentStore.getState().activeCollectionPath).toBe("/new/workspace/collection");

    // Old response arrives late — must not overwrite the new workspace's environments.
    resolveOld([
      { name: "legacy", variables: {}, secrets: [] },
    ]);
    await stale;

    expect(useEnvironmentStore.getState().environments.map((e) => e.name)).toEqual(["staging"]);
    expect(useEnvironmentStore.getState().activeCollectionPath).toBe("/new/workspace/collection");
  });
});
