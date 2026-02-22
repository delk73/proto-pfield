import React, { createContext, useContext, useReducer, Dispatch, ReactNode } from 'react';
import { SDFNode, SDFOperation, SDFPrimitive, isOperation, isPrimitive, PrecisionFieldState, SDFNodeType, OPERATOR_REGISTRY } from './types';

export type MovePosition = 'inside' | 'before' | 'after';

type Action =
  | { type: 'ADD_NODE'; payload: { type: SDFNodeType; position: [number, number] } }
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'UPDATE_NODE'; payload: { id: string; updates: Partial<SDFNode>; noHistory?: boolean } }
  | { type: 'SET_OP_TYPE'; payload: { id: string; type: SDFOperation['type'] } }
  | { type: 'MOVE_NODE'; payload: { draggedId: string; targetId: string; position: MovePosition } }
  | { type: 'REORDER_NODE'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'SET_ROOT'; payload: SDFNode | null }
  | { type: 'TOGGLE_COLLAPSE'; payload: string }
  | { type: 'TOGGLE_DEBUG' }
  | { type: 'START_TRANSACTION' }
  | { type: 'COMMIT_TRANSACTION' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' };

const MAX_HISTORY = 50;

export interface EnhancedState extends PrecisionFieldState {
  past: (SDFNode | null)[];
  future: (SDFNode | null)[];
  checkpoint: SDFNode | null;
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().split('-')[0];
  }
  return Math.random().toString(36).substring(2, 10);
};

export const createNode = (type: SDFNodeType, position: [number, number] = [0,0]): SDFNode => {
  const id = generateId();
  const base = { id, type, visible: true, position, rotation: 0, scale: [1, 1] as [number, number], collapsed: false };
  const meta = OPERATOR_REGISTRY[type];
  const name = meta?.label || type;

  if (type === 'circle') return { ...base, type: 'circle', radius: 0.3, name } as SDFPrimitive;
  if (type === 'box') return { ...base, type: 'box', size: [0.3, 0.2], name } as SDFPrimitive;
  if (type === 'capsule') return { ...base, type: 'capsule', radius: 0.15, length: 0.4, name } as SDFPrimitive;
  
  const opBase: Partial<SDFOperation> = {
    children: [],
    blend: 0.1,
    opRadius: 0.1,
    thickness: 0.05,
    period: [1.0, 1.0],
    axis: 'x',
    offset: 0.0,
    strength: 0.5,
    frequency: 2.0,
    amplitude: 0.05,
    minLimit: -1.0,
    maxLimit: 1.0,
    name
  };

  return { ...base, ...opBase, type: type as SDFOperation['type'] } as SDFOperation;
};

const createInitialFixture = (): SDFNode => {
    const scene = createNode('union') as SDFOperation;
    scene.name = "Domain Inheritance Regression Suite";
    scene.blend = 0.0;

    const test1 = createNode('mirror') as SDFOperation;
    test1.name = "1: Parent Mirror + 2 Siblings";
    test1.offset = -0.8;
    test1.axis = 'x';
    const t1_capsule = createNode('capsule', [-0.5, 0.6]);
    const t1_circle = createNode('circle', [-0.6, 0.3]);
    test1.children = [t1_capsule, t1_circle];

    const test2 = createNode('mirror') as SDFOperation;
    test2.name = "2: Parent Mirror + Nested Group";
    test2.offset = 0.8;
    test2.axis = 'x';
    const t2_group = createNode('group') as SDFOperation;
    const t2_box1 = createNode('box', [0.5, -0.6]);
    const t2_box2 = createNode('box', [0.65, -0.4]);
    t2_group.children = [t2_box1, t2_box2];
    test2.children = [t2_group];

    const test3 = createNode('mirror') as SDFOperation;
    test3.name = "3: Composed Mirrors";
    test3.axis = 'y';
    test3.offset = -0.4;
    const t3_childMirror = createNode('mirror') as SDFOperation;
    t3_childMirror.axis = 'x';
    const t3_core = createNode('circle', [0.2, -0.2]);
    t3_childMirror.children = [t3_core];
    test3.children = [t3_childMirror];

    scene.children = [test1, test2, test3];
    return scene;
};

const initialState: EnhancedState = {
  root: createInitialFixture(),
  selectedId: null,
  debugMode: 'normal',
  past: [],
  future: [],
  checkpoint: null,
};

const findNodeInTree = (node: SDFNode | null, id: string): SDFNode | null => {
    if (!node) return null;
    if (node.id === id) return node;
    if (isOperation(node)) {
        for (const child of node.children) {
            const found = findNodeInTree(child, id);
            if (found) return found;
        }
    }
    return null;
};

const findParentInTree = (root: SDFNode, targetId: string): SDFOperation | null => {
    if (isOperation(root)) {
        if (root.children.some(c => c.id === targetId)) return root;
        for (const child of root.children) {
            const found = findParentInTree(child, targetId);
            if (found) return found;
        }
    }
    return null;
};

const deleteFromTree = (root: SDFNode, id: string): SDFNode | null => {
  if (root.id === id) return null; 
  if (isOperation(root)) {
    const children = root.children.map(c => deleteFromTree(c, id)).filter((c): c is SDFNode => c !== null);
    return { ...root, children };
  }
  return root;
};

const insertInTree = (root: SDFNode, targetId: string, nodeToInsert: SDFNode, position: MovePosition): SDFNode => {
    if (isOperation(root)) {
        const idx = root.children.findIndex(c => c.id === targetId);
        if (idx !== -1) {
            const newChildren = [...root.children];
            if (position === 'inside') {
                const targetNode = root.children[idx];
                if (isOperation(targetNode)) {
                    if (targetNode.type === 'displace' && targetNode.children.length >= 2) return root;
                    const updatedTarget = { ...targetNode, children: [...targetNode.children, nodeToInsert] };
                    newChildren[idx] = updatedTarget;
                }
            } else if (position === 'before') {
                newChildren.splice(idx, 0, nodeToInsert);
            } else if (position === 'after') {
                newChildren.splice(idx + 1, 0, nodeToInsert);
            }
            return { ...root, children: newChildren };
        }
        return { ...root, children: root.children.map(c => insertInTree(c, targetId, nodeToInsert, position)) };
    }
    return root;
};

const updateInTree = (node: SDFNode, id: string, updates: Partial<SDFNode>): SDFNode => {
  if (node.id === id) return { ...node, ...updates } as SDFNode;
  if (isOperation(node)) {
    return { ...node, children: node.children.map(c => updateInTree(c, id, updates)) };
  }
  return node;
};

const expandAncestors = (node: SDFNode | null, targetId: string): SDFNode | null => {
    if (!node) return null;
    if (node.id === targetId) return node;
    if (isOperation(node)) {
        let pathFound = false;
        const newChildren = node.children.map(child => {
            const res = expandAncestors(child, targetId);
            if (res !== child || child.id === targetId) pathFound = true;
            return res as SDFNode;
        });
        if (pathFound) return { ...node, children: newChildren, collapsed: false };
    }
    return node;
};

const pushHistory = (state: EnhancedState, nextRoot: SDFNode | null): EnhancedState => {
    if (state.root === nextRoot) return { ...state, root: nextRoot };
    const newPast = [state.root, ...state.past].slice(0, MAX_HISTORY);
    return { ...state, root: nextRoot, past: newPast, future: [] };
};

const reducer = (state: EnhancedState, action: Action): EnhancedState => {
  switch (action.type) {
    case 'UNDO': {
        if (state.past.length === 0) return state;
        const [prev, ...remainingPast] = state.past;
        return { ...state, root: prev, past: remainingPast, future: [state.root, ...state.future] };
    }
    case 'REDO': {
        if (state.future.length === 0) return state;
        const [next, ...remainingFuture] = state.future;
        return { ...state, root: next, past: [state.root, ...state.past], future: remainingFuture };
    }
    case 'START_TRANSACTION':
        return { ...state, checkpoint: state.root };
    
    case 'COMMIT_TRANSACTION': {
        if (!state.checkpoint || state.checkpoint === state.root) return { ...state, checkpoint: null };
        const newPast = [state.checkpoint, ...state.past].slice(0, MAX_HISTORY);
        return { ...state, past: newPast, future: [], checkpoint: null };
    }

    case 'ADD_NODE': {
        const newNode = createNode(action.payload.type, action.payload.position);
        if (!state.root) return pushHistory(state, newNode);
        const selected = findNodeInTree(state.root, state.selectedId || '');
        let nextRoot = state.root;
        if (selected) {
            if (isPrimitive(selected) && isOperation(newNode)) {
                const recursiveWrap = (current: SDFNode): SDFNode => {
                    if (current.id === selected.id) return { ...newNode, children: [current] } as SDFOperation;
                    if (isOperation(current)) return { ...current, children: current.children.map(recursiveWrap) };
                    return current;
                };
                nextRoot = recursiveWrap(state.root);
            } else if (isOperation(selected)) {
                if (selected.type === 'displace' && selected.children.length >= 2) {
                   const parent = findParentInTree(state.root, selected.id);
                   if (parent) nextRoot = updateInTree(state.root, parent.id, { children: [...parent.children, newNode] });
                } else {
                   nextRoot = updateInTree(state.root, selected.id, { children: [...selected.children, newNode] });
                }
            } else {
                const parent = findParentInTree(state.root, selected.id);
                if (parent) nextRoot = updateInTree(state.root, parent.id, { children: [...parent.children, newNode] });
            }
        } else {
            const newOp = createNode('union') as SDFOperation;
            newOp.children = [state.root, newNode];
            nextRoot = newOp;
        }
        return { ...pushHistory(state, nextRoot), selectedId: newNode.id };
    }

    case 'MOVE_NODE': {
        const { draggedId, targetId, position } = action.payload;
        if (draggedId === targetId) return state;
        const draggedNode = findNodeInTree(state.root, draggedId);
        const targetNode = findNodeInTree(state.root, targetId);
        if (!draggedNode || !targetNode) return state;
        let baseRoot = deleteFromTree(state.root!, draggedId);
        if (!baseRoot) return state;
        let nextRoot;
        if (isPrimitive(targetNode) && isOperation(draggedNode) && position === 'inside') {
            const recursiveWrap = (current: SDFNode): SDFNode => {
                if (current.id === targetId) return { ...draggedNode, children: [current] } as SDFOperation;
                if (isOperation(current)) return { ...current, children: current.children.map(recursiveWrap) };
                return current;
            };
            nextRoot = recursiveWrap(baseRoot);
        } else {
            nextRoot = insertInTree(baseRoot, targetId, draggedNode, position);
        }
        return pushHistory(state, nextRoot);
    }

    case 'UPDATE_NODE': {
        const nextRoot = updateInTree(state.root!, action.payload.id, action.payload.updates);
        if (state.checkpoint || action.payload.noHistory) return { ...state, root: nextRoot };
        return pushHistory(state, nextRoot);
    }

    case 'DELETE_NODE':
        return pushHistory(state, deleteFromTree(state.root!, action.payload));

    case 'REORDER_NODE': {
        const { id, direction } = action.payload;
        const parent = findParentInTree(state.root!, id);
        if (!parent) return state;
        const idx = parent.children.findIndex(c => c.id === id);
        const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= parent.children.length) return state;
        const newChildren = [...parent.children];
        [newChildren[idx], newChildren[nextIdx]] = [newChildren[nextIdx], newChildren[idx]];
        return pushHistory(state, updateInTree(state.root!, parent.id, { children: newChildren }));
    }

    case 'SET_OP_TYPE': {
        const node = findNodeInTree(state.root, action.payload.id);
        if (!node) return state;
        const oldTypeMeta = OPERATOR_REGISTRY[node.type];
        const newTypeMeta = OPERATOR_REGISTRY[action.payload.type];
        const updates: Partial<SDFNode> = { type: action.payload.type };
        if (node.name === oldTypeMeta.label || !node.name) updates.name = newTypeMeta.label;
        return pushHistory(state, updateInTree(state.root!, action.payload.id, updates));
    }

    case 'SELECT_NODE':
        return { ...state, selectedId: action.payload, root: action.payload ? expandAncestors(state.root, action.payload) : state.root };

    case 'TOGGLE_COLLAPSE':
        const nodeToToggle = findNodeInTree(state.root, action.payload);
        if (!nodeToToggle) return state;
        return { ...state, root: updateInTree(state.root!, action.payload, { collapsed: !nodeToToggle.collapsed }) };

    case 'TOGGLE_DEBUG':
        return { ...state, debugMode: state.debugMode === 'normal' ? 'field' : 'normal' };

    case 'RESET':
        return initialState;

    default:
        return state;
  }
};

const StoreContext = createContext<{ state: EnhancedState; dispatch: Dispatch<Action> } | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return React.createElement(StoreContext.Provider, { value: { state, dispatch } }, children);
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
