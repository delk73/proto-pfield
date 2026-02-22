
import { compileToIR } from '../../src/services/compiler';
import { serializeIR, computeHash } from '../../src/services/validation';
import * as fixtures from './fixtures/regression_suites';

export async function runGoldenTests() {
  const testCases = [
    { name: 'Mirror Inheritance (IR)', node: fixtures.FIXTURE_MIRROR_SIBLINGS, expected: fixtures.GOLDEN_HASHES.MIRROR_SIBLINGS },
    { name: 'Order Determinism (IR)', node: fixtures.FIXTURE_REORDER_SIBLINGS, expected: fixtures.GOLDEN_HASHES.REORDER_SIBLINGS },
    { name: 'Domain Toggle (IR)', node: fixtures.FIXTURE_NO_DOMAIN, expected: fixtures.GOLDEN_HASHES.NO_DOMAIN },
    { name: 'Deep Tree (IR)', node: fixtures.FIXTURE_DEEP_NESTING, expected: fixtures.GOLDEN_HASHES.DEEP_NESTING }
  ];

  console.log('--- PRECISION-FIELD IR GATE START ---');

  for (const test of testCases) {
    // 1. Compile to IR
    const ir = compileToIR(test.node);
    
    // 2. Serialize to Stable String
    const serialized = serializeIR(ir);
    
    // 3. Hash
    const actualHash = await computeHash(serialized);

    if (actualHash !== test.expected) {
      console.error(`[CI FAILURE] ${test.name} Hash Mismatch`);
      console.error(`Expected: ${test.expected}`);
      console.error(`Actual:   ${actualHash}`);
      console.error(`IR Snapshot: ${serialized.slice(0, 300)}...`);
      throw new Error(`Golden IR hash mismatch for ${test.name}`);
    }

    console.log(`[PASS] ${test.name}`);
  }

  console.log('--- IR CONTRACTS VERIFIED ---');
}
