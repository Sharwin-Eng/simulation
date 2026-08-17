# Architecture & Design Decisions Log

## DEC-001: Technical Stack Selection
- **Context:** System requires high performance, cross-platform portability, zero heavyweight dependencies, and clean architecture.
- **Decision:** Node.js (ES Modules, Native `node:test` runner, HTML5 Canvas 2D, Vanilla CSS).
- **Rationale:** Standard JS runtime provides zero-dependency execution, deterministic 10Hz tick loops, and seamless browser client integration without npm build steps.

## DEC-002: Simulation Time Model
- **Context:** Need physical accuracy without real-time drift or floating-point instability.
- **Decision:** Fixed-timestep clock at $\Delta t = 0.1\text{s}$ ($10\text{Hz}$).
- **Rationale:** Ensures exact seed-level bit-identical reproducibility regardless of CPU load or UI frame rates.

## DEC-003: Vehicle Kinematics Model
- **Context:** Longitudinal vehicle movement on single-lane approaches.
- **Decision:** Kinematics model with acceleration $a=2.6\text{ m/s}^2$, deceleration $d=4.5\text{ m/s}^2$, and exact safe stopping speed clamping $v_{\text{safe}} = \sqrt{2 \cdot d \cdot \Delta x}$.
- **Rationale:** Prevents stop line overshoots while producing natural acceleration and braking profiles.

## DEC-004: Adaptive Signal Control Algorithm
- **Context:** Fixed-timer controllers cause unnecessary delays during asymmetric traffic loads.
- **Decision:** Demand-proportional green allocation bounded by minimum ($10\text{s}$) and maximum ($60\text{s}$) green times, with emergency priority overrides.
- **Rationale:** Allocates green duration dynamically based on queue length ratios while preventing approach starvation.

## DEC-005: Traffic DSL Compiler Architecture
- **Context:** Flexible scenario definition and traffic rule evaluation.
- **Decision:** Multi-pass compiler pipeline: Lexer → Parser → Semantic Analyzer → Register IR Generator → IR Optimizer (Constant Folding, DCE) → Executor.
- **Rationale:** Clean separation of concerns allows live step-by-step visual inspection of compiler intermediate states in the dashboard.
