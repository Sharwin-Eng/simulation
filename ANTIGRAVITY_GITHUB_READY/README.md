# ANTIGRAVITY — Autonomous Adaptive Traffic Light Controller & DSL Studio

**ANTIGRAVITY** is a modular, high-performance computational simulation engine, Domain-Specific Language (DSL) compiler, and interactive web visualization suite designed for modeling, controlling, and optimizing 4-way urban traffic intersections.

---

## Key Features

1. **Deterministic Discrete-Event Simulation Engine ($10\text{Hz}$)**
   - Seeded Mulberry32 Pseudo-Random Number Generator (PRNG) for bit-exact reproducibility.
   - Longitudinal vehicle kinematics with realistic acceleration, deceleration, minimum gap maintenance, and safe-speed braking.
   - Multithread-friendly single-loop execution architecture.

2. **Virtual Sensors & Adaptive Control**
   - Virtual Queue Length, Sliding-Window Arrival Rate, and Waiting Time sensors.
   - **Adaptive Controller:** Demand-proportional green allocation with starvation bounds ($10\text{s}$–$60\text{s}$) and Emergency Vehicle Priority Overrides.
   - **Fixed-Timer Controller:** Baseline fixed-cycle comparison.

3. **Traffic DSL Compiler Pipeline**
   - Domain-Specific Language for declarative scenario setup, intersection layout, and emergency rule scripting.
   - Multi-stage pipeline: **Lexer** $\rightarrow$ **Parser** $\rightarrow$ **Semantic Analyzer** $\rightarrow$ **IR Generator** $\rightarrow$ **IR Optimizer** (Constant Folding, DCE) $\rightarrow$ **IR Executor**.
   - Live Compiler Inspector tab in the web studio.

4. **Interactive Visualization Dashboard & Studio**
   - HTML5 Canvas 2D rendering of the 4-way intersection layout, real-time animated vehicles, and glowing signal states.
   - Live telemetry tables, queue counters, average wait gauges, and congestion index meters.
   - Comparative Benchmark runner quantifying percentage improvements.

---

## Directory Structure

```
ANTIGRAVITY_PROJECT/
├── README.md
├── SPECIFICATION.md
├── REQUIREMENTS.md
├── DECISIONS.md
├── MILESTONES.md
│
├── source/
│   ├── simulation/         # Core kinematics, lane, road, signal & engine
│   │   └── sensors/        # Queue, arrival rate, wait time sensors & aggregator
│   ├── control/            # Fixed-timer & Adaptive traffic controllers
│   ├── compiler/           # Lexer, Parser, Semantic, IR Gen, Optimizer, Executor
│   ├── analytics/          # Metrics Collector & Comparison Engine
│   └── visualization/      # Node.js HTTP server & HTML5/CSS/JS web dashboard
│       └── public/         # Frontend assets (index.html, style.css, app.js)
│
├── tests/                  # Unit test suites (node:test)
│   ├── simulation.test.js
│   ├── sensors-control.test.js
│   └── compiler.test.js
│
├── examples/               # Scenario JSON definitions & DSL sample scripts
└── configs/                # Default simulation parameters
```

---

## Quick Start Guide

### 1. Run Unit Test Suite
To run all 80 unit tests across the simulation engine, virtual sensors, controllers, analytics engine, and compiler pipeline:

```bash
node --test tests/simulation.test.js tests/sensors-control.test.js tests/compiler.test.js
```

### 2. Start Web Application Dashboard
Launch the zero-dependency web visualization server:

```bash
node source/visualization/server.js
```

Then open your browser and navigate to:
```
http://localhost:3000
```

---

## License & Governance
Built under the **ANTIGRAVITY** engineering paradigm: *Requirements $\rightarrow$ System Model $\rightarrow$ Architecture $\rightarrow$ Component Design $\rightarrow$ Implementation $\rightarrow$ Verification*.
