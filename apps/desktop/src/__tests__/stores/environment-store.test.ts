import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEnvironmentStore } from "@/stores/environment-store";

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
}));

describe("Environment Store", () => {
  beforeEach(() => {
    useEnvironmentStore.setState({
      environments: [],
      activeEnvironmentName: null,
      activeCollectionPath: null,
      runtimeOverrides: {},
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
});

