# 30: Vertical Slices

To implement a new feature (e.g., a "Twist" operator), follow these steps:

## Slice 1: Schema ([types.ts](../../types.ts))
-   Add the type to `DomainOp` union.
-   Register in `OPERATOR_REGISTRY` with an icon and label.

## Slice 2: Evaluator ([compiler.ts](../../services/compiler.ts))
-   Add GLSL function (e.g., `opTwist`) to `PREAMBLE`.
-   Implement the case in `processNode` to generate the space warp and recursive child calls.

## Slice 3: Controls ([Editor.tsx](../../components/Editor.tsx))
-   Add specialized inputs for parameters (e.g., `strength`) in `PropertiesPanel`.
-   Verify real-time updates via `UPDATE_NODE`.

## Slice 4: Direct Manipulation ([Gizmos.tsx](../../components/Gizmos.tsx))
-   Add a visual handle for the operator's primary parameter.
-   Update `useGizmoDrag` with a new mode for the operator.

## Slice 5: Regression Gate ([store.ts](../../store.ts))
-   Add a test case to `createInitialFixture` that uses the new operator in a nested context.
-   Verify that it survives Undo/Redo cycles.