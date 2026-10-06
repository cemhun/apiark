import { create } from "zustand";

export interface DndDragItem {
  path: string;
  type: "request" | "folder";
  parentDir: string;
  collectionPath: string;
  orderKey: string;
  name: string;
}

export interface DndDropTarget {
  kind: "before" | "into";
  /** Path of the hovered node (request, folder, or collection). */
  path: string;
  /** Directory the dragged item will be placed into. */
  destDir: string;
  collectionPath: string;
}

interface CollectionDndState {
  dragItem: DndDragItem | null;
  dropTarget: DndDropTarget | null;
  overlayPos: { x: number; y: number };
  startDrag: (item: DndDragItem, pos: { x: number; y: number }) => void;
  setDropTarget: (target: DndDropTarget | null) => void;
  setOverlayPos: (pos: { x: number; y: number }) => void;
  endDrag: () => void;
}

export const useCollectionDndStore = create<CollectionDndState>((set) => ({
  dragItem: null,
  dropTarget: null,
  overlayPos: { x: 0, y: 0 },
  startDrag: (item, pos) => set({ dragItem: item, dropTarget: null, overlayPos: pos }),
  setDropTarget: (target) => set({ dropTarget: target }),
  setOverlayPos: (pos) => set({ overlayPos: pos }),
  endDrag: () => set({ dragItem: null, dropTarget: null }),
}));

/** Resolve the drop target under the pointer, if any. */
export function resolveDropTarget(
  clientX: number,
  clientY: number,
  dragItem: DndDragItem,
): DndDropTarget | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  const target = el.closest("[data-drop-path]") as HTMLElement | null;
  if (!target) return null;

  const path = target.dataset.dropPath;
  const parentDir = target.dataset.dropParent;
  const collectionPath = target.dataset.dropCollection;
  const nodeType = target.dataset.dropType;
  if (!path || !parentDir || !collectionPath || !nodeType) return null;

  // Cannot drop onto self
  if (path === dragItem.path) return null;

  // Cannot drop a folder into itself or a descendant
  if (
    dragItem.type === "folder" &&
    (path === dragItem.path ||
      path.startsWith(dragItem.path + "/") ||
      parentDir === dragItem.path ||
      parentDir.startsWith(dragItem.path + "/"))
  ) {
    return null;
  }

  if (nodeType === "folder" || nodeType === "collection") {
    const rect = target.getBoundingClientRect();
    const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    // Top edge → reorder before this folder/collection sibling; otherwise nest into it
    if (ratio < 0.3 && nodeType === "folder") {
      return {
        kind: "before",
        path,
        destDir: parentDir,
        collectionPath,
      };
    }
    return {
      kind: "into",
      path,
      destDir: path,
      collectionPath,
    };
  }

  return {
    kind: "before",
    path,
    destDir: parentDir,
    collectionPath,
  };
}
