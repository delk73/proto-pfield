
import { SDFNode, isOperation, SDFOperation } from '../../types';
import { compileToIR } from '../../services/compiler';
import { serializeIR, computeHash } from '../../services/validation';
import { FIXTURE_MIRROR_SIBLINGS } from './fixtures/regression_suites';

/**
 * DETERMINISTIC SEEDED PRNG (LCG)
 */
class DeterministicRNG {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}

/**
 * MUTATION ENGINE
 * Applies deterministic modifications to the graph.
 */
function mutateGraph(node: SDFNode, rng: DeterministicRNG): SDFNode {
  if (isOperation(node) && node.children.length > 1) {
    const r = rng.next();
    // 1. Reorder Siblings
    if (r < 0.33) {
      const children = [...node.children];
      const i = Math.floor(rng.next() * children.length);
      const j = Math.floor(rng.next() * children.length);
      [children[i], children[j]] = [children[j], children[i]];
      return { ...node, children };
    }
    // 2. Tweak Param
    if (r < 0.66) {
      return { ...node, blend: Math.max(0, node.blend + (rng.next() - 0.5) * 0.1) };
    }
  }
  return node;
}

export async function runMutationTests() {
  const SEEDS = [1, 7, 42, 1337, 9001];
  const STEPS = 50;

  console.log('--- MUTATION DETERMINISM HARNESS START ---');

  for (const seed of SEEDS) {
    const rng = new DeterministicRNG(seed);
    const hashes: string[] = [];

    let currentGraph = JSON.parse(JSON.stringify(FIXTURE_MIRROR_SIBLINGS));

    for (let i = 0; i < STEPS; i++) {
      currentGraph = mutateGraph(currentGraph, rng);
      const ir = compileToIR(currentGraph);
      const serialized = serializeIR(ir);
      const hash = await computeHash(serialized);
      hashes.push(hash);
    }

    // Run again with same seed
    const rng2 = new DeterministicRNG(seed);
    let currentGraph2 = JSON.parse(JSON.stringify(FIXTURE_MIRROR_SIBLINGS));

    for (let i = 0; i < STEPS; i++) {
      currentGraph2 = mutateGraph(currentGraph2, rng2);
      const ir = compileToIR(currentGraph2);
      const serialized = serializeIR(ir);
      const hash = await computeHash(serialized);
      
      if (hash !== hashes[i]) {
        throw new Error(`Determinism Failure on Seed ${seed} at Step ${i}`);
      }
    }
    console.log(`[PASS] Seed ${seed} Determinism Verified (${STEPS} steps)`);
  }
  console.log('--- ALL MUTATION SEQUENCES STABLE ---');
}
