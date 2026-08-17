# ANTIGRAVITY — Technical Specification

**Document Status:** ACTIVE  
**Last Updated:** 2026-08-17  
**Version:** 1.0

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Simulation Engine](#3-simulation-engine)
4. [Road Network Model](#4-road-network-model)
5. [Vehicle Model](#5-vehicle-model)
6. [Traffic Signal Model](#6-traffic-signal-model)
7. [Virtual Sensor Design](#7-virtual-sensor-design)
8. [Traffic Control Algorithm](#8-traffic-control-algorithm)
9. [Compiler Architecture](#9-compiler-architecture)
10. [DSL Grammar](#10-dsl-grammar)
11. [Analytics Engine](#11-analytics-engine)
12. [Visualization Design](#12-visualization-design)
13. [Configuration System](#13-configuration-system)
14. [Performance Requirements](#14-performance-requirements)
15. [Known Limitations](#15-known-limitations)

---

## 1. System Overview

ANTIGRAVITY is a browser-based adaptive traffic control simulation system. It simulates a four-way signalized intersection where vehicles arrive from four directions, queue at red signals, and depart on green. Virtual sensors detect traffic conditions, and an adaptive controller adjusts green-light durations to minimize average waiting time.

A custom domain-specific language (DSL) allows users to define traffic scenarios and control rules. The DSL is processed through a full compiler pipeline: lexer → parser → semantic analyzer → AST → IR → optimizer → executor.

The system provides real-time visualization via HTML5 Canvas and a metrics dashboard comparing adaptive control against fixed-timer control.

---

## 2. Architecture

### 2.1 Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VISUALIZATION LAYER                   │
│   CanvasRenderer  │  Dashboard  │  CompilerViz          │
├─────────────────────────────────────────────────────────┤
│                    ANALYTICS LAYER                       │
│   MetricsCollector  │  ComparisonEngine  │  Reporter    │
├─────────────────────────────────────────────────────────┤
│                    CONTROL LAYER                         │
│   AdaptiveController  │  FixedController  │  Priority   │
├─────────────────────────────────────────────────────────┤
│                    SENSOR LAYER                          │
│   QueueSensor  │  ArrivalSensor  │  WaitSensor          │
├─────────────────────────────────────────────────────────┤
│                    SIMULATION LAYER                      │
│   SimulationEngine  │  Vehicles  │  Roads  │  Signals   │
├─────────────────────────────────────────────────────────┤
│                    COMPILER LAYER                        │
│   Lexer → Parser → Semantic → AST → IR → Opt → Exec    │
├─────────────────────────────────────────────────────────┤
│                    CONFIGURATION                         │
│   JSON Configs  │  DSL Programs  │  Scenarios           │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
User Input (DSL / Config / UI)
        │
        ▼
┌──────────────┐     ┌──────────────┐
│   Compiler   │────▶│  Sim Config  │
└──────────────┘     └──────┬───────┘
                            │
                            ▼
                   ┌────────────────┐
                   │  Sim Engine    │◄──── Clock (fixed timestep)
                   │  (tick loop)   │
                   └───────┬────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Vehicles │ │  Roads   │ │ Signals  │
        └──────────┘ └──────────┘ └──────────┘
              │            │            │
              ▼            ▼            ▼
        ┌────────────────────────────────────┐
        │           Virtual Sensors          │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │        Traffic Controller          │
        │   (reads sensors, writes signals)  │
        └────────────────┬───────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼                     ▼
        ┌──────────┐         ┌──────────┐
        │ Analytics│         │  Viz     │
        └──────────┘         └──────────┘
```

### 2.3 Module Dependencies

```
visualization ──▶ simulation, analytics, compiler
analytics ──────▶ simulation (sensors)
control ────────▶ simulation (sensors, signals)
simulation ─────▶ (none — core layer)
compiler ───────▶ (none — independent pipeline)
```

Each layer depends only on layers below it. The compiler is fully independent.

---

## 3. Simulation Engine

### 3.1 Simulation Loop

The simulation uses a **fixed timestep** model. Each logical tick advances simulation time by a configurable interval (default: 100ms = 0.1 seconds).

```
LOOP:
  1. Advance simulation clock by TICK_INTERVAL
  2. Spawn new vehicles (based on arrival rate)
  3. Update vehicle positions (move, queue, depart)
  4. Update sensor readings
  5. Run traffic controller (may change signals)
  6. Collect analytics data
  7. Emit tick event (for visualization)
```

### 3.2 Simulation Clock

```
SimulationClock:
  currentTime: number       // Simulation time in seconds
  tickInterval: number      // Duration per tick (default 0.1s)
  tickCount: number         // Total ticks elapsed
  speedMultiplier: number   // How many ticks per real second (default 10 = real-time)

  tick():
    currentTime += tickInterval
    tickCount += 1
```

### 3.3 Entity Management

The engine maintains arrays of active entities:
- `vehicles[]` — All active vehicle entities
- `roads[]` — Road segments
- `signals[]` — Traffic signal instances

Vehicles are created by the spawner and removed when they exit the simulation boundary.

### 3.4 Random Number Generator

A seeded pseudo-random number generator (Mulberry32 or similar) ensures deterministic simulation.

```
SeededRandom:
  seed: number
  next(): number  // Returns [0, 1)
  nextInt(min, max): number
  nextFloat(min, max): number
```

---

## 4. Road Network Model

### 4.1 Intersection Layout

The intersection is modeled as a four-way junction with roads extending in four cardinal directions.

```
                    ║ ↓ IN  ║ ↑ OUT ║
                    ║  N.in ║ N.out ║
                    ║       ║       ║
════════════════════╬═══════╬═══════╬════════════════════
  W.out  ← OUT     ║               ║     → IN   E.in
────────────────────║  INTERSECTION ║────────────────────
  W.in   → IN      ║               ║     ← OUT  E.out
════════════════════╬═══════╬═══════╬════════════════════
                    ║       ║       ║
                    ║ S.out ║ S.in  ║
                    ║ ↓ OUT ║ ↑ IN  ║
```

### 4.2 Road

```
Road:
  id: string
  direction: NORTH | SOUTH | EAST | WEST
  inboundLane: Lane      // Vehicles approaching intersection
  outboundLane: Lane     // Vehicles departing intersection
  length: number         // Road length in meters (default 300m)
```

### 4.3 Lane

```
Lane:
  id: string
  direction: INBOUND | OUTBOUND
  vehicles: Vehicle[]    // Ordered by position (closest to intersection first)
  length: number
  laneWidth: number      // For rendering (default 3.5m)
```

### 4.4 Intersection

```
Intersection:
  id: string
  roads: Road[4]         // N, S, E, W
  signals: Signal[4]     // One per inbound approach
  position: {x, y}      // Center position for rendering
  size: number           // Intersection box size
```

---

## 5. Vehicle Model

### 5.1 Vehicle Entity

```
Vehicle:
  id: number
  type: NORMAL | EMERGENCY
  position: number           // Distance along lane (0 = start, length = intersection)
  speed: number              // Current speed (m/s)
  maxSpeed: number           // Maximum speed (default 13.9 m/s ≈ 50 km/h)
  acceleration: number       // Acceleration rate (m/s²)
  deceleration: number       // Braking deceleration (m/s²)
  length: number             // Vehicle length (default 4.5m)
  lane: Lane                 // Current lane reference
  state: APPROACHING | QUEUED | CROSSING | DEPARTED
  waitStartTime: number      // When the vehicle started waiting (for metrics)
  totalWaitTime: number      // Accumulated waiting time
```

### 5.2 Vehicle States

```
APPROACHING ──▶ QUEUED ──▶ CROSSING ──▶ DEPARTED
     │                                      │
     └──────── (green signal, no queue) ────┘
                    (direct crossing)
```

- **APPROACHING:** Moving toward the intersection at speed.
- **QUEUED:** Stopped at red signal or behind another vehicle.
- **CROSSING:** Moving through the intersection on green.
- **DEPARTED:** Has exited the simulation boundary. Removed from entity list.

### 5.3 Vehicle Movement

Each tick:

```
IF signal is RED and vehicle is near stop line:
  decelerate to stop
  state = QUEUED
ELSE IF vehicle ahead is too close:
  match speed of vehicle ahead (simple car-following)
ELSE IF signal is GREEN and state is QUEUED:
  accelerate
  state = CROSSING
ELSE:
  maintain or accelerate toward maxSpeed

position += speed * tickInterval
```

### 5.4 Vehicle Spawning

Vehicles are spawned at the start of inbound lanes based on a configurable arrival rate (vehicles per minute per direction). Spawning uses the seeded RNG for determinism.

```
Spawner:
  For each direction:
    probability = arrivalRate[direction] * tickInterval / 60
    IF random() < probability:
      spawn vehicle at position 0 of inbound lane
```

---

## 6. Traffic Signal Model

### 6.1 Signal States

```
Signal:
  id: string
  direction: NORTH | SOUTH | EAST | WEST
  state: RED | GREEN | YELLOW
  timeInState: number     // Seconds in current state
```

### 6.2 Phase Model

The intersection operates in two phases:

```
Phase A (North-South):
  N signal = GREEN, S signal = GREEN
  E signal = RED,   W signal = RED

Phase B (East-West):
  N signal = RED,   S signal = RED
  E signal = GREEN, W signal = GREEN
```

Phase transitions include a YELLOW interval:

```
Phase A GREEN ──▶ Phase A YELLOW ──▶ Phase B GREEN ──▶ Phase B YELLOW ──▶ Phase A GREEN
```

### 6.3 Signal Timing Parameters

```
minGreenTime: number      // Minimum green duration (default 10s)
maxGreenTime: number      // Maximum green duration (default 60s)
yellowTime: number        // Yellow duration (default 3s)
allRedTime: number        // All-red clearance interval (default 2s)
```

---

## 7. Virtual Sensor Design

### 7.1 Sensor Interface

All sensors implement a common interface:

```
Sensor:
  id: string
  direction: NORTH | SOUTH | EAST | WEST
  read(): SensorReading
  reset(): void
```

### 7.2 Queue Length Sensor

Counts the number of vehicles in QUEUED state on the inbound lane.

```
QueueLengthSensor:
  read(): { direction, queueLength: number, timestamp }
```

### 7.3 Arrival Rate Sensor

Measures the number of vehicles entering the inbound lane per time window.

```
ArrivalRateSensor:
  windowSize: number  // Time window in seconds (default 30s)
  read(): { direction, arrivalRate: number, timestamp }
```

### 7.4 Waiting Time Sensor

Calculates the average waiting time of queued vehicles.

```
WaitingTimeSensor:
  read(): { direction, avgWaitTime: number, maxWaitTime: number, timestamp }
```

### 7.5 Sensor Aggregator

Collects readings from all sensors and provides a unified snapshot.

```
SensorAggregator:
  sensors: Sensor[]
  snapshot(): {
    north: { queueLength, arrivalRate, avgWaitTime },
    south: { queueLength, arrivalRate, avgWaitTime },
    east:  { queueLength, arrivalRate, avgWaitTime },
    west:  { queueLength, arrivalRate, avgWaitTime },
    timestamp: number
  }
```

---

## 8. Traffic Control Algorithm

### 8.1 Fixed-Timer Controller

Cycles between phases with constant durations.

```
FixedTimerController:
  greenTime: number       // Fixed green duration per phase (default 30s)
  yellowTime: number      // Yellow duration (default 3s)

  update(clock):
    cycle through Phase A → Yellow → Phase B → Yellow → Phase A
    with fixed durations
```

### 8.2 Adaptive Controller

Adjusts green time based on sensor readings.

```
AdaptiveController:
  minGreen: number        // Minimum green time (default 10s)
  maxGreen: number        // Maximum green time (default 60s)
  yellowTime: number      // Yellow duration (default 3s)
  extensionStep: number   // Green extension per demand unit (default 2s)

  calculateGreenTime(sensorSnapshot):
    demandA = queueLength(N) + queueLength(S)
    demandB = queueLength(E) + queueLength(W)
    totalDemand = demandA + demandB

    IF totalDemand == 0:
      greenTimeA = minGreen
      greenTimeB = minGreen
    ELSE:
      proportionA = demandA / totalDemand
      proportionB = demandB / totalDemand
      greenTimeA = clamp(proportionA * cycleGreen, minGreen, maxGreen)
      greenTimeB = clamp(proportionB * cycleGreen, minGreen, maxGreen)

    RETURN { greenTimeA, greenTimeB }
```

### 8.3 Starvation Prevention

Even if one direction has zero demand, it receives at least `minGreen` seconds. This prevents indefinite red for any approach.

```
// Starvation bonus ensures low-volume approaches eventually receive service
IF greenTime < minGreen:
  greenTime = minGreen
```

### 8.4 Emergency Vehicle Priority

When an emergency vehicle is detected:

```
IF emergencyVehicle detected on approach X:
  IF X is not in current green phase:
    Shorten current green to yellowTime
    Switch to phase containing X
    Set green to maxGreen for emergency clearance
  Mark emergency override active
  When emergency vehicle departs:
    Resume normal adaptive control
```

---

## 9. Compiler Architecture

### 9.1 Pipeline

```
Source Code (DSL text)
    │
    ▼
┌──────────┐
│  LEXER   │──▶ Token[]
└──────────┘
    │
    ▼
┌──────────┐
│  PARSER  │──▶ AST (Abstract Syntax Tree)
└──────────┘
    │
    ▼
┌──────────────────┐
│ SEMANTIC ANALYZER│──▶ Annotated AST (type-checked, validated)
└──────────────────┘
    │
    ▼
┌──────────┐
│ IR GEN   │──▶ IR (Intermediate Representation)
└──────────┘
    │
    ▼
┌──────────┐
│ OPTIMIZER│──▶ Optimized IR
└──────────┘
    │
    ▼
┌──────────┐
│ EXECUTOR │──▶ Simulation Configuration / Runtime Commands
└──────────┘
```

### 9.2 Token Types

```
KEYWORD:     intersection, road, signal, phase, when, set, spawn, 
             vehicle, green, red, yellow, duration, rate, speed,
             emergency, if, else, while, print, scenario, config,
             direction, north, south, east, west, queue, wait,
             extend, by, to, for, and, or, not, true, false
IDENTIFIER:  [a-zA-Z_][a-zA-Z0-9_]*
NUMBER:      [0-9]+(\.[0-9]+)?
STRING:      "..."
OPERATOR:    + - * / = == != > < >= <= 
DELIMITER:   ( ) { } , ; :
UNIT:        s, ms, m, km/h, vpm (vehicles per minute)
COMMENT:     // single-line comment
EOF:         end of input
```

### 9.3 AST Node Types

```
Program          — root node, contains statement list
ScenarioDecl     — scenario name { body }
ConfigStmt       — config key = value
IntersectionDecl — intersection definition
RoadDecl         — road with direction, lanes
PhaseDecl        — phase name { signal assignments }
RuleDecl         — when condition { actions }
SpawnStmt        — spawn vehicle at direction with rate
SetStmt          — set property = value
PrintStmt        — print expression
IfStmt           — if condition { body } else { body }
WhileStmt        — while condition { body }
BinaryExpr       — left op right
UnaryExpr        — op operand
Literal          — number, string, boolean
Identifier       — variable name
```

### 9.4 IR Design

The IR is a flat list of instructions:

```
IR Instruction:
  op: string           // Operation code
  args: any[]          // Arguments
  result: string       // Result register (optional)

Operations:
  LOAD_CONST       — Load a constant value
  LOAD_VAR         — Load a variable
  STORE_VAR        — Store to a variable
  ADD, SUB, MUL, DIV — Arithmetic
  CMP_EQ, CMP_GT, CMP_LT, CMP_GTE, CMP_LTE, CMP_NEQ — Comparison
  JUMP             — Unconditional jump
  JUMP_IF_FALSE    — Conditional jump
  CALL             — Call built-in function
  SET_SIGNAL       — Set traffic signal state
  SET_PHASE        — Activate a phase
  SPAWN_VEHICLE    — Spawn a vehicle
  SET_CONFIG       — Set a configuration value
  PRINT            — Output to console/dashboard
  HALT             — End execution
```

### 9.5 Optimizations

- **Constant Folding:** Evaluate constant expressions at compile time.
- **Dead Code Elimination:** Remove unreachable instructions.
- **Strength Reduction:** Replace expensive operations with cheaper equivalents where possible.

### 9.6 Executor

The executor interprets the optimized IR instruction-by-instruction:

```
Executor:
  ip: number             // Instruction pointer
  registers: Map         // Named registers
  simulation: SimEngine  // Reference to simulation engine

  execute(ir: IRInstruction[]):
    WHILE ip < ir.length:
      instruction = ir[ip]
      SWITCH instruction.op:
        LOAD_CONST: registers[result] = args[0]
        STORE_VAR:  variables[args[0]] = registers[args[1]]
        SET_SIGNAL: simulation.setSignal(args[0], args[1])
        SPAWN_VEHICLE: simulation.spawnVehicle(args[0], args[1])
        ...
      ip += 1
```

---

## 10. DSL Grammar

### 10.1 Example Program

```
// Define a rush hour scenario
scenario rush_hour {
  config speed = 50 km/h
  config tick = 100 ms

  intersection main {
    road north { lanes 1 }
    road south { lanes 1 }
    road east  { lanes 1 }
    road west  { lanes 1 }
  }

  // Spawn rates
  spawn vehicle at north rate 30 vpm
  spawn vehicle at south rate 25 vpm
  spawn vehicle at east  rate 40 vpm
  spawn vehicle at west  rate 35 vpm

  // Adaptive control rule
  when queue north > 10 and queue south > 10 {
    extend green north_south by 10s
  }

  when emergency at north {
    set signal north to green
    set signal south to red
    set signal east to red
    set signal west to red
  }
}
```

### 10.2 Formal Grammar (EBNF)

```
program        = statement* EOF
statement      = scenarioDecl | configStmt | intersectionDecl
               | spawnStmt | ruleDecl | setStmt | printStmt
               | ifStmt | whileStmt

scenarioDecl   = "scenario" IDENTIFIER "{" statement* "}"
configStmt     = "config" IDENTIFIER "=" expression unit?
intersectionDecl = "intersection" IDENTIFIER "{" roadDecl* "}"
roadDecl       = "road" direction "{" roadBody "}"
roadBody       = "lanes" NUMBER

spawnStmt      = "spawn" "vehicle" "at" direction "rate" NUMBER unit?
ruleDecl       = "when" condition "{" statement* "}"
setStmt        = "set" target "to" expression
printStmt      = "print" expression

ifStmt         = "if" condition "{" statement* "}" ("else" "{" statement* "}")?
whileStmt      = "while" condition "{" statement* "}"

condition      = expression (("and" | "or") expression)*
expression     = comparison
comparison     = term (("==" | "!=" | ">" | "<" | ">=" | "<=") term)?
term           = factor (("+" | "-") factor)*
factor         = unary (("*" | "/") unary)*
unary          = ("not" | "-") unary | primary
primary        = NUMBER | STRING | "true" | "false" | IDENTIFIER
               | "queue" direction | "wait" direction
               | "emergency" "at" direction
               | "(" expression ")"

direction      = "north" | "south" | "east" | "west"
target         = "signal" direction | "phase" IDENTIFIER | IDENTIFIER
unit           = "s" | "ms" | "m" | "km/h" | "vpm"
```

---

## 11. Analytics Engine

### 11.1 Per-Cycle Metrics

Collected at the end of each signal cycle:

```
CycleMetrics:
  cycleNumber: number
  timestamp: number
  vehicleCount: { north, south, east, west }
  queueLength: { north, south, east, west }
  avgWaitTime: { north, south, east, west }
  maxWaitTime: { north, south, east, west }
  throughput: { north, south, east, west }   // vehicles departed this cycle
  greenTime: { phaseA, phaseB }
```

### 11.2 Aggregate Metrics

```
AggregateMetrics:
  totalVehicles: number
  totalDeparted: number
  overallAvgWaitTime: number
  overallMaxWaitTime: number
  overallThroughput: number       // vehicles/minute
  congestionIndex: number         // 0.0 (free flow) to 1.0 (gridlock)
```

### 11.3 Congestion Index

```
congestionIndex = totalQueuedVehicles / totalCapacity

WHERE:
  totalQueuedVehicles = sum of queue lengths across all directions
  totalCapacity = sum of lane capacities (lane length / vehicle spacing)
```

### 11.4 Comparison Engine

Runs the same scenario twice — once with adaptive control, once with fixed-timer — and produces a comparative report:

```
ComparisonReport:
  scenario: string
  adaptive: AggregateMetrics
  fixed: AggregateMetrics
  improvement: {
    avgWaitTimeReduction: percentage
    throughputIncrease: percentage
    congestionReduction: percentage
  }
```

---

## 12. Visualization Design

### 12.1 Canvas Layout

The Canvas is divided into regions:

```
┌────────────────────────────────────────┐
│            TRAFFIC ANIMATION           │
│                                        │
│    Roads, vehicles, signals rendered   │
│    Top-down view of intersection       │
│                                        │
├────────────────────────────────────────┤
│            DASHBOARD PANEL             │
│  Metrics  │  Charts  │  Controls       │
└────────────────────────────────────────┘
```

### 12.2 Traffic Animation

- Roads rendered as gray rectangles with lane markings
- Vehicles rendered as colored rectangles (blue = normal, red = emergency)
- Signals rendered as colored circles at intersection approaches
- Vehicle queues visible as stacked rectangles on approach roads
- Smooth movement via interpolation between simulation ticks

### 12.3 Dashboard

- Current signal states (color indicators)
- Queue lengths per direction (bar chart or numeric)
- Average wait time (line chart over time)
- Throughput (vehicles/minute)
- Congestion index (gauge or numeric)
- Controller mode indicator (adaptive / fixed)

### 12.4 Controls

- Play / Pause
- Speed: 1x, 2x, 5x, 10x
- Scenario selector dropdown
- Controller mode toggle (adaptive / fixed)
- Reset button

### 12.5 Compiler Pipeline Visualization

When a DSL program is compiled, display:

```
Source → Tokens → AST (tree view) → IR (instruction list) → Output
```

Each stage is shown in a panel with its output, allowing the user to inspect the compilation process.

---

## 13. Configuration System

### 13.1 Default Configuration

Stored in `configs/default.json`:

```json
{
  "simulation": {
    "tickInterval": 0.1,
    "speedMultiplier": 1,
    "randomSeed": 42,
    "maxVehicles": 10000,
    "simulationDuration": 300
  },
  "road": {
    "length": 300,
    "laneWidth": 3.5,
    "lanesPerDirection": 1
  },
  "vehicle": {
    "length": 4.5,
    "maxSpeed": 13.9,
    "acceleration": 2.6,
    "deceleration": 4.5,
    "minGap": 2.0
  },
  "signal": {
    "minGreenTime": 10,
    "maxGreenTime": 60,
    "yellowTime": 3,
    "allRedTime": 2,
    "fixedGreenTime": 30
  },
  "arrival": {
    "north": 20,
    "south": 20,
    "east": 20,
    "west": 20
  }
}
```

### 13.2 Configuration Loading

Configuration is loaded at simulation startup. User-provided config overrides default values. Missing keys fall back to defaults.

---

## 14. Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Visual FPS | 60 | requestAnimationFrame timing |
| Simulation tick | < 33ms for 10,000 vehicles | Console timing |
| Memory | < 200MB | Browser DevTools |
| Startup | < 2 seconds | Manual timing |
| Canvas draw | < 16ms per frame | requestAnimationFrame timing |

### 14.1 Performance Strategy

- Use typed arrays for vehicle position data if entity count exceeds 5,000
- Spatial bucketing for collision/proximity checks if needed
- Limit Canvas draw calls via dirty-region rendering
- Object pooling for vehicles (avoid GC pressure)

---

## 15. Known Limitations

1. **Single intersection only** — No corridor or network simulation
2. **Single lane per direction** — No lane changing or turning movements
3. **Simplified car-following** — Not a calibrated traffic flow model (not Wiedemann, not IDM)
4. **No pedestrians** — Pedestrian phases are not modeled
5. **No turning movements** — All vehicles proceed straight through the intersection
6. **No GPS/routing** — Vehicles have no origin-destination routing
7. **2D top-down only** — No 3D visualization
8. **Browser-only** — No native desktop application
