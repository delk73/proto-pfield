# 20: Critical Flows

## 1. Subtree Transformation
-   **Action**: Drag a `Mirror` operator onto a `Group` containing 3 Circles.
-   **Expected**: All 3 circles appear mirrored.
-   **Failure Mode**: Only the first circle is mirrored (indicates `parentP` propagation failure in `compiler.ts`).

## 2. Interactive Smoothing
-   **Action**: Hold 'B' and drag horizontally in [Scene.tsx](../../components/Scene.tsx).
-   **Expected**: The `blend` value of the selected Boolean node updates smoothly.
-   **Observed**: The [Scene.tsx](../../components/Scene.tsx) `InputOverlay` displays the value in real-time.

## 3. Node Type Swapping
-   **Action**: Click a `Circle` in the hierarchy, then click the `Box` icon in the palette.
-   **Expected**: The node transforms into a Box, retaining its position and name if it was the default "Circle".
-   **Contract**: This uses `SET_OP_TYPE` in [store.ts](../../store.ts) to preserve node identity (`id`).

## 4. Hierarchy Reordering
-   **Action**: Use the Up/Down arrows in [Editor.tsx](../../components/Editor.tsx) properties panel.
-   **Expected**: The node shifts position in the hierarchy. If it's the target of a `subtract`, the subtraction result changes visually.

## 5. Domain Composition
-   **Action**: Nest a `Mirror (X)` inside a `Mirror (Y)`.
-   **Expected**: Four-way quadrant symmetry.
-   **Failure Mode**: Nested mirror plane is ignored or incorrectly offset (indicates coordinate space stacking error).