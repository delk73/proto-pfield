
export type PrimitiveType = 'circle' | 'box' | 'capsule';

export type BooleanOp = 
  | 'union' | 'subtract' | 'intersect' | 'xor'
  | 'smooth_union' | 'smooth_subtract' | 'smooth_intersect';

export type DomainOp = 
  | 'repeat' | 'mirror' | 'bend' | 'twist' | 'displace';

export type MetricOp = 
  | 'dilate' | 'erode' | 'shell' | 'invert' | 'clamp';

export type UtilityOp = 'group';

export type SDFNodeType = PrimitiveType | BooleanOp | DomainOp | MetricOp | UtilityOp;

export interface OperatorMeta {
  type: SDFNodeType;
  label: string;
  category: 'Boolean' | 'Domain' | 'Metric' | 'Utility' | 'Primitive';
  icon: string;
  description?: string;
}

export const OPERATOR_REGISTRY: Record<SDFNodeType, OperatorMeta> = {
  circle: { type: 'circle', label: 'Circle', category: 'Primitive', icon: 'Circle' },
  box: { type: 'box', label: 'Box', category: 'Primitive', icon: 'Square' },
  capsule: { type: 'capsule', label: 'Capsule', category: 'Primitive', icon: 'CapsuleIcon' },
  
  union: { type: 'union', label: 'Union', category: 'Boolean', icon: 'Combine' },
  subtract: { type: 'subtract', label: 'Subtract', category: 'Boolean', icon: 'Scissors' },
  intersect: { type: 'intersect', label: 'Intersect', category: 'Boolean', icon: 'Target' },
  xor: { type: 'xor', label: 'XOR', category: 'Boolean', icon: 'Layers' },
  smooth_union: { type: 'smooth_union', label: 'Smooth Union', category: 'Boolean', icon: 'Cloud' },
  smooth_subtract: { type: 'smooth_subtract', label: 'Smooth Subtract', category: 'Boolean', icon: 'Eraser' },
  smooth_intersect: { type: 'smooth_intersect', label: 'Smooth Intersect', category: 'Boolean', icon: 'Crosshair' },

  repeat: { type: 'repeat', label: 'Repeat (Modulo)', category: 'Domain', icon: 'Grid' },
  mirror: { type: 'mirror', label: 'Mirror', category: 'Domain', icon: 'Columns2' },
  bend: { type: 'bend', label: 'Bend', category: 'Domain', icon: 'Route' },
  twist: { type: 'twist', label: 'Twist', category: 'Domain', icon: 'Tornado' },
  displace: { type: 'displace', label: 'Displace', category: 'Domain', icon: 'Waves' },

  dilate: { type: 'dilate', label: 'Dilate (Expand)', category: 'Metric', icon: 'Maximize' },
  erode: { type: 'erode', label: 'Erode (Round)', category: 'Metric', icon: 'Minimize' },
  shell: { type: 'shell', label: 'Shell (Annular)', category: 'Metric', icon: 'CircleDashed' },
  invert: { type: 'invert', label: 'Invert Field', category: 'Metric', icon: 'Contrast' },
  clamp: { type: 'clamp', label: 'Clamp Field', category: 'Metric', icon: 'Lock' },

  group: { type: 'group', label: 'Group', category: 'Utility', icon: 'FolderTree' },
};

export interface SDFNodeBase {
  id: string;
  type: SDFNodeType;
  name?: string;
  visible?: boolean;
  collapsed?: boolean;
}

export interface SDFPrimitive extends SDFNodeBase {
  type: PrimitiveType;
  position: [number, number]; 
  rotation: number; // radians
  scale: [number, number];
  radius?: number;
  size?: [number, number]; 
  length?: number;
}

export interface SDFOperation extends SDFNodeBase {
  type: Exclude<SDFNodeType, PrimitiveType>;
  children: SDFNode[];
  blend: number; // k parameter for smooth blending
  opRadius?: number;      
  thickness?: number;     
  period?: [number, number]; 
  axis?: 'x' | 'y';       
  offset?: number;        
  strength?: number;      
  frequency?: number;     
  amplitude?: number;     
  minLimit?: number;      
  maxLimit?: number;      
}

export type SDFNode = SDFPrimitive | SDFOperation;

/**
 * INTERMEDIATE REPRESENTATION (IR) SCHEMA
 * This is the canonical layer for determinism and testing.
 */
export interface IRNode {
  id: string;
  type: SDFNodeType;
  params: Record<string, any>;
  domainStack: string[]; // List of IDs of domain operators inherited
  children: string[];   // List of child IDs in evaluation order
}

export interface IR {
  nodes: Record<string, IRNode>;
  rootId: string;
  evaluationOrder: string[]; // Depth-first evaluation sequence
}

export const isPrimitive = (node: SDFNode): node is SDFPrimitive => {
  return ['circle', 'box', 'capsule'].includes(node.type);
};

export const isOperation = (node: SDFNode): node is SDFOperation => {
  return !isPrimitive(node);
};

export interface PrecisionFieldState {
  root: SDFNode | null;
  selectedId: string | null;
  debugMode: 'normal' | 'field';
}
