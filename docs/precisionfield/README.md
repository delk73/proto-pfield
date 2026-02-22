# PrecisionField Architecture Documentation

This folder contains the technical specifications for the PrecisionField SDF system.

## Navigation
-   [**00: Overview**](./00_overview.md) - High-level system design and loop.
-   [**10: Contracts**](./10_contracts.md) - Non-negotiable rules for the graph and evaluation.
-   [**20: Critical Flows**](./20_critical_flows.md) - Workflows to verify during development.
-   [**30: Vertical Slices**](./30_vertical_slices.md) - Guide for adding new operators.
-   [**40: Test Plan**](./40_test_plan.md) - Regression gating and golden fixtures.

## How to use during development
1.  **Before modifying [compiler.ts](../../services/compiler.ts)**: Read [10: Contracts](./10_contracts.md) to understand domain inheritance.
2.  **After modifying [store.ts](../../store.ts)**: Verify behavior against [20: Critical Flows](./20_critical_flows.md).
3.  **When adding a new primitive/operator**: Follow [30: Vertical Slices](./30_vertical_slices.md).