# PrecisionField

PrecisionField is an interactive visualization and control surface for the Precision-DPW geometric signal core. It provides a real-time field-based view of deterministic signal evolution via a graph-based Signed Distance Function (SDF) editor.

## Documentation
The internal logic and architectural contracts are documented in the [PrecisionField Documentation Suite](./docs/precisionfield/README.md).

### Quick Links
- [**Architecture Overview**](./docs/precisionfield/00_overview.md)
- [**Domain Inheritance Contracts**](./docs/precisionfield/10_contracts.md)
- [**Test & Regression Plan**](./docs/precisionfield/40_test_plan.md)

## Tech Stack
- **Frontend**: React 19, Tailwind CSS
- **Graphics**: Three.js, @react-three/fiber
- **Architecture**: Context API + useReducer for state, Custom GLSL compiler for SDFs
- **Icons**: Lucide-React

## Getting Started
The application loads a "Regression Suite" by default. Use the sidebar to add primitives (Circles, Boxes, Capsules) and compose them using Boolean operators (Union, Subtract, Intersect) or Domain warps (Mirror, Repeat).

### Interactive Controls
- **Click**: Select an object in the viewport or hierarchy.
- **Drag Gizmos**: Direct manipulation of position, rotation, and geometry parameters.
- **'B' + Mouse Drag**: Adjust Smooth Blend power for the selected Boolean operation.
- **Middle-Mouse / Alt+Click**: Pan the viewport.
- **Scroll**: Zoom.