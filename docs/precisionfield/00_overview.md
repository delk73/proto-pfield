# 00: Overview

PrecisionField is a real-time, graph-based Signed Distance Function (SDF) composition environment. It enables the creation of complex 2D geometry through a hierarchical tree of operations.

## Core System Loop
1.  **Interaction**: Users modify the graph via the [Editor.tsx](../../components/Editor.tsx) or [Gizmos.tsx](../../components/Gizmos.tsx).
2.  **State Management**: Actions (e.g., `UPDATE_NODE`, `MOVE_NODE`) are processed by the reducer in [store.ts](../../store.ts).
3.  **Compilation**: The `compileTreeToGLSL` function in [compiler.ts](../../services/compiler.ts) generates an optimized GLSL fragment shader from the current `state.root`.
4.  **Rendering**: The [Scene.tsx](../../components/Scene.tsx) component injects this GLSL into a `ShaderMaterial` rendered on a full-screen quad.
5.  **Synchronization**: Gizmos read the `selectedId` and current node state to position handles, dispatching `noHistory` updates for smooth real-time feedback.

## System Boundaries
-   **Single-Source-of-Truth**: The [store.ts](../../store.ts) is the unique authoritative state. UI components do not hold local "shadow" copies of geometric data.
-   **Stateless Compiler**: The [compiler.ts](../../services/compiler.ts) is a pure function. It accepts an `SDFNode` and returns a string, ensuring deterministic visual output for any given graph state.
-   **Performance**: To maintain 60FPS, the compiler avoids O(N²) code generation by warping the coordinate space once per domain operator rather than per-leaf.