import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  useCollectionDndStore,
  resolveDropTarget,
  type DndDragItem,
} from "@/stores/collection-dnd-store";

function makeEl(attrs: Record<string, string>, rect: Partial<DOMRect> = {}) {
  const el = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  el.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: 28,
      right: 200,
      width: 200,
      height: 28,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
  document.body.appendChild(el);
  document.elementFromPoint = () => el;
  return el;
}

const dragRequest: DndDragItem = {
  path: "/ws/col-a/get-users.yaml",
  type: "request",
  parentDir: "/ws/col-a",
  collectionPath: "/ws/col-a",
  orderKey: "get-users",
  name: "Get Users",
};

describe("collection-dnd-store", () => {
  beforeEach(() => {
    useCollectionDndStore.getState().endDrag();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("starts and ends a drag", () => {
    useCollectionDndStore.getState().startDrag(dragRequest, { x: 10, y: 20 });
    expect(useCollectionDndStore.getState().dragItem?.path).toBe(dragRequest.path);
    expect(useCollectionDndStore.getState().overlayPos).toEqual({ x: 10, y: 20 });
    useCollectionDndStore.getState().endDrag();
    expect(useCollectionDndStore.getState().dragItem).toBeNull();
    expect(useCollectionDndStore.getState().dropTarget).toBeNull();
  });

  it("resolves drop-before on a request in another collection", () => {
    makeEl({
      "data-drop-path": "/ws/col-b/list.yaml",
      "data-drop-parent": "/ws/col-b",
      "data-drop-collection": "/ws/col-b",
      "data-drop-type": "request",
    });
    const target = resolveDropTarget(10, 10, dragRequest);
    expect(target).toEqual({
      kind: "before",
      path: "/ws/col-b/list.yaml",
      destDir: "/ws/col-b",
      collectionPath: "/ws/col-b",
    });
  });

  it("resolves drop-into on a folder", () => {
    makeEl(
      {
        "data-drop-path": "/ws/col-b/auth",
        "data-drop-parent": "/ws/col-b",
        "data-drop-collection": "/ws/col-b",
        "data-drop-type": "folder",
      },
      { top: 0, height: 28 },
    );
    // Mid-row → into
    const target = resolveDropTarget(10, 14, dragRequest);
    expect(target).toEqual({
      kind: "into",
      path: "/ws/col-b/auth",
      destDir: "/ws/col-b/auth",
      collectionPath: "/ws/col-b",
    });
  });

  it("resolves drop-into on a collection header", () => {
    makeEl({
      "data-drop-path": "/ws/col-b",
      "data-drop-parent": "/ws/col-b",
      "data-drop-collection": "/ws/col-b",
      "data-drop-type": "collection",
    });
    const target = resolveDropTarget(10, 10, dragRequest);
    expect(target).toEqual({
      kind: "into",
      path: "/ws/col-b",
      destDir: "/ws/col-b",
      collectionPath: "/ws/col-b",
    });
  });

  it("rejects dropping a folder into itself", () => {
    const dragFolder: DndDragItem = {
      path: "/ws/col-a/auth",
      type: "folder",
      parentDir: "/ws/col-a",
      collectionPath: "/ws/col-a",
      orderKey: "auth",
      name: "auth",
    };
    makeEl({
      "data-drop-path": "/ws/col-a/auth/nested",
      "data-drop-parent": "/ws/col-a/auth",
      "data-drop-collection": "/ws/col-a",
      "data-drop-type": "folder",
    });
    expect(resolveDropTarget(10, 14, dragFolder)).toBeNull();
  });

  it("rejects dropping onto self", () => {
    makeEl({
      "data-drop-path": dragRequest.path,
      "data-drop-parent": dragRequest.parentDir,
      "data-drop-collection": dragRequest.collectionPath,
      "data-drop-type": "request",
    });
    expect(resolveDropTarget(10, 10, dragRequest)).toBeNull();
  });
});
