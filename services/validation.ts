
import { SDFNode, isOperation, OPERATOR_REGISTRY, IR, IRNode } from '../types';
import { compileToIR } from './compiler';

/**
 * DETERMINISTIC SERIALIZER
 * Ensures identical graphs produce identical strings across machines.
 */
export const serializeIR = (ir: IR): string => {
  const sortedNodes: Record<string, any> = {};
  
  // 1. Sort nodes by ID
  const sortedIds = Object.keys(ir.nodes).sort();
  sortedIds.forEach(id => {
    const node = ir.nodes[id];
    // 2. Sort params by key
    const sortedParams: Record<string, any> = {};
    Object.keys(node.params).sort().forEach(p => {
      sortedParams[p] = node.params[p];
    });
    
    sortedNodes[id] = {
      type: node.type,
      params: sortedParams,
      domainStack: node.domainStack, // inheritance order matters
      children: node.children       // evaluation/boolean order matters
    };
  });

  return JSON.stringify({
    rootId: ir.rootId,
    evaluationOrder: ir.evaluationOrder,
    nodes: sortedNodes
  });
};

/**
 * SHA-256 Utility
 * Used for golden hash gating.
 */
export const computeHash = async (text: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * DEBUG UTILITY: Inheritance Stack
 */
export const getInheritanceStack = (root: SDFNode, targetId: string): string[] => {
  const stack: string[] = [];
  const find = (current: SDFNode): boolean => {
    if (current.id === targetId) return true;
    if (isOperation(current)) {
      const meta = OPERATOR_REGISTRY[current.type];
      if (meta.category === 'Domain') stack.push(`${meta.label} (${current.id})`);
      for (const child of current.children) {
        if (find(child)) return true;
      }
      if (meta.category === 'Domain') stack.pop();
    }
    return false;
  };
  find(root);
  return stack;
};
