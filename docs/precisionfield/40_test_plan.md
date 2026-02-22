
# 40: Test Plan (CI Gating)

## Authoritative Layer: Intermediate Representation (IR)
PrecisionField uses a custom **Intermediate Representation (IR)** as the canonical layer for testing.
Unlike GLSL, the IR captures semantic structural intent without whitespace or driver-specific noise.

### Ordering Rules (Determinism)
To ensure stable hashes across environments, the following rules are enforced during IR serialization:
1. **Node Map Sorting**: All nodes in the `nodes` object are sorted alphabetically by their unique ID.
2. **Param Key Sorting**: Properties within a node's `params` object are sorted alphabetically by key.
3. **Evaluation Stability**: `evaluationOrder` is determined by a strict depth-first traversal of the graph.
4. **Inheritance Order**: `domainStack` preserves the exact nesting order from root to leaf.

### Automated Gates
1. **Golden Hash Regression** (`golden_hash.test.ts`):
   - Compares the SHA256 of the serialized IR against stored snapshots.
   - Blocks merges if structural semantics change unexpectedly.
2. **Mutation Determinism** (`mutation_determinism.test.ts`):
   - Proves that the same sequence of graph edits (using a seeded PRNG) results in the exact same IR hash sequence.
   - Ensures zero dependency on environment state or random execution order.

## Structural Verification
The IR explicitly exposes the `domainStack` per node. This allows testing of the "Single Warp" contract by ensuring that domain IDs appear correctly in the stack of their descendants and nowhere else.

## Performance Validation
- **IR Generation**: Must be < 1ms for the regression suite.
- **Serialization Overhead**: Minimal; optimized for comparison.
