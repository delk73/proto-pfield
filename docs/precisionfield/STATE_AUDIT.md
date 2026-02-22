# State Audit: PrecisionField

This document identifies the authoritative storage locations for all system state to prevent "shadow state" duplication.

## Authoritative Store (`store.ts`)

| State Key | Semantic Purpose | Authoritative Location |
| :--- | :--- | :--- |
| **Scene Tree** | Canonical graph hierarchy and geometry | `state.root` |
| **Selection** | Current user focus ID | `state.selectedId` |
| **History** | Undo/Redo buffers | `state.past` / `state.future` |
| **View Mode** | Explainability/Debug toggle | `state.debugMode` |
| **Tree Expansion** | Visual hierarchy state | Node-local `collapsed` property in `state.root` |
| **Consistency** | Results of the contract validator | `state.consistency` |

## Transient UI State (Component Local)

| Component | State Key | Semantic Purpose |
| :--- | :--- | :--- |
| `Editor.tsx` | `dropPos` | Drag-and-drop ghost indicator |
| `Gizmos.tsx` | `draggingMode` | Active direct-manipulation handle type |
| `Gizmos.tsx` | `hovered` | Hover feedback for handles |
| `Scene.tsx` | `zoomRef` | Viewport transformation (Ortho Zoom) |
| `Scene.tsx` | `isPanning` | Viewport transformation (Camera position) |

## Derived State (Computed)

| Semantic Concept | Computation Method | Origin |
| :--- | :--- | :--- |
| **Inheritance Stack** | `getInheritanceStack(state.root, id)` | [validation.ts](../../services/validation.ts) |
| **GLSL Output** | `compileTreeToGLSL(state.root)` | [compiler.ts](../../services/compiler.ts) |
| **Selected Node** | `findNodeInTree(state.root, state.selectedId)` | [store.ts](../../store.ts) |

## Recommendations
1. **Selection Sync**: Avoid storing selected property values in component state during drag; always use `UPDATE_NODE` with `noHistory: true`.
2. **Expansion**: Expansion is currently persisted in the root tree. While this ensures it survives undo/redo, it makes the tree JSON larger. This is a conscious trade-off for "Hierarchy State Stability".
