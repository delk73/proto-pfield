# 10: Contracts & Invariants

## Graph Model ([types.ts](../../types.ts))
-   **Structural Integrity**: The graph MUST be a tree. Multi-parenting is not supported.
-   **Node Taxonomy**: 
    -   `SDFPrimitive`: Leaf nodes with inherent geometry (Circle, Box, Capsule).
    -   `SDFOperation`: Branch nodes that modify their children (Boolean, Domain, Metric, Utility).
-   **Ordering**: Sibling order in `SDFOperation.children` MUST be preserved. In `subtract` operations, the first child is the "body" and subsequent children are "cutters".

## Domain Inheritance ([compiler.ts](../../services/compiler.ts))
Domain operators (e.g., Mirror, Repeat, Bend) modify the coordinate space (`p`) for all their descendants.

### The Physics of `p`
1.  **Context Variable**: `processNode` receives a `parentP` string. It MUST use this variable as the input for its local transformations.
2.  **Space Warping**: A domain node MUST create a new unique variable (e.g., `vec2 p_id`) and pass it to all recursive child calls.
3.  **Inheritance**: Children MUST evaluate within the warped space of their parent. This ensures that a `Mirror` applied to a `Group` correctly reflects every element in that group.

### Worked Example: Multi-Sibling Mirror
```glsl
// Parent Mirror Node
vec2 p_mir1 = opMirror(p, -0.8, true); 

// Child evaluations use the same p_mir1
float d_child1 = sdCircle(p_mir1 - offset1, rad1);
float d_child2 = sdBox(p_mir1 - offset2, size2);

// Result combines them in the mirrored space
float res_mir1 = min(d_child1, d_child2);
```

## State & Undo ([store.ts](../../store.ts))
-   **Transaction Boundary**: Continuous UI interactions (sliders/dragging) MUST wrap updates between `START_TRANSACTION` and `COMMIT_TRANSACTION`.
-   **History Preservation**: Only `COMMIT_TRANSACTION` or discrete actions (Delete, Reorder) trigger a history snapshot.
-   **Selection Persistence**: The `selectedId` MUST survive tree re-ordering and type-swapping.