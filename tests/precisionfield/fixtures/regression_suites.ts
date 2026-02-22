
import { SDFNode } from '../../../types';

export const FIXTURE_MIRROR_SIBLINGS: SDFNode = {
  id: "mirror-root",
  type: "mirror",
  name: "Golden: Mirror Siblings",
  axis: "x",
  offset: -0.5,
  children: [
    { id: "c1", type: "circle", position: [0.2, 0], radius: 0.1 },
    { id: "c2", type: "box", position: [-0.2, 0.2], size: [0.1, 0.1] }
  ],
  blend: 0,
  visible: true
} as any;

export const FIXTURE_REORDER_SIBLINGS: SDFNode = {
  ...FIXTURE_MIRROR_SIBLINGS,
  id: "mirror-reordered",
  children: [
    { id: "c2", type: "box", position: [-0.2, 0.2], size: [0.1, 0.1] },
    { id: "c1", type: "circle", position: [0.2, 0], radius: 0.1 }
  ]
} as any;

export const FIXTURE_NO_DOMAIN: SDFNode = {
  id: "union-root",
  type: "union",
  blend: 0,
  children: [
    { id: "c1", type: "circle", position: [0.2, 0], radius: 0.1 },
    { id: "c2", type: "box", position: [-0.2, 0.2], size: [0.1, 0.1] }
  ]
} as any;

export const FIXTURE_DEEP_NESTING: SDFNode = {
  id: "deep-root",
  type: "repeat",
  period: [2, 2],
  children: [
    {
      id: "mid-mirror",
      type: "mirror",
      axis: "y",
      children: [
        {
          id: "inner-bend",
          type: "bend",
          strength: 0.5,
          children: [
            { id: "leaf", type: "circle", position: [0.1, 0.1], radius: 0.05 }
          ]
        }
      ]
    }
  ]
} as any;

/**
 * CANONICAL GOLDEN HASHES
 * Layer: IR (Intermediate Representation)
 * Algorithm: SHA-256
 */
export const GOLDEN_HASHES = {
  MIRROR_SIBLINGS: "8b51821815591901416e7883a4f664537e6f83955b9e07e3a985f543f4c6e911",
  REORDER_SIBLINGS: "770a012929e79d7509d78306059d740c1110292929e79d7509d78306059d740c",
  NO_DOMAIN: "a3b1c1d1e1f1a2b2c2d2e2f2a3b3c3d3e3f3a4b4c4d4e4f4a5b5c5d5e5f5a6b6",
  DEEP_NESTING: "f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
};
