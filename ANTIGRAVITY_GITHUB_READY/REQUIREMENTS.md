# ANTIGRAVITY — Requirements

**Document Status:** ACTIVE  
**Last Updated:** 2026-08-17  
**Version:** 1.0

---

## Requirement Status Legend

| Status | Meaning |
|--------|---------|
| CONFIRMED | Agreed and will be implemented |
| ASSUMED | Reasonable assumption, not explicitly confirmed |
| UNKNOWN | Needs clarification before implementation |
| OPTIONAL | Implement if resources remain |

## Priority Legend

| Priority | Meaning |
|----------|---------|
| P0 | CORE — Required for simulation to function |
| P1 | IMPORTANT — Strongly improves the project |
| P2 | ENHANCEMENT — Useful but not necessary |
| P3 | OPTIONAL — Only if resources remain |

---

## 1. Functional Requirements — Simulation

| ID | Requirement | Priority | Status | Verification |
|----|-------------|----------|--------|--------------|
| REQ-SIM-001 | Simulate a four-way intersection with approach roads from all four cardinal directions | P0 | CONFIRMED | Visual inspection + unit test |
| REQ-SIM-002 | Each approach road shall have at least one lane in each direction (inbound and outbound) | P0 | CONFIRMED | Unit test |
| REQ-SIM-003 | Model vehicles as discrete entities that spawn, move, queue, and depart | P0 | CONFIRMED | Unit test |
| REQ-SIM-004 | Vehicles shall obey traffic signals (stop on red, proceed on green) | P0 | CONFIRMED | Unit test + visual inspection |
| REQ-SIM-005 | Implement traffic signals with states: RED, GREEN, YELLOW | P0 | CONFIRMED | State machine unit test |
| REQ-SIM-006 | Simulation shall use a fixed timestep model (100ms logical tick) | P0 | CONFIRMED | Unit test |
| REQ-SIM-007 | Simulation shall be deterministic given the same random seed | P0 | CONFIRMED | Reproducibility test |
| REQ-SIM-008 | Vehicles shall arrive at configurable rates per direction | P1 | CONFIRMED | Configuration test |
| REQ-SIM-009 | Support configurable vehicle speed | P1 | CONFIRMED | Configuration test |
| REQ-SIM-010 | Vehicles shall maintain safe following distance (no collision overlap) | P1 | ASSUMED | Visual inspection + unit test |

---

## 2. Functional Requirements — Virtual Sensors

| ID | Requirement | Priority | Status | Verification |
|----|-------------|----------|--------|--------------|
| REQ-SNS-001 | Detect vehicle count per approach direction | P0 | CONFIRMED | Unit test |
| REQ-SNS-002 | Measure queue length per lane (number of stopped/waiting vehicles) | P0 | CONFIRMED | Unit test |
| REQ-SNS-003 | Track per-vehicle waiting time at the intersection | P0 | CONFIRMED | Unit test |
| REQ-SNS-004 | Measure vehicle arrival rate per direction per time window | P1 | CONFIRMED | Unit test |
| REQ-SNS-005 | Sensors shall query simulation state directly (software observers) | P0 | CONFIRMED | Architecture review |

---

## 3. Functional Requirements — Traffic Control

| ID | Requirement | Priority | Status | Verification |
|----|-------------|----------|--------|--------------|
| REQ-CTL-001 | Dynamically allocate green-light duration proportional to demand | P0 | CONFIRMED | Unit test + analytics comparison |
| REQ-CTL-002 | Implement phase sequencing: North-South phase and East-West phase with yellow transitions | P0 | CONFIRMED | State machine test |
| REQ-CTL-003 | Enforce minimum green time per phase to prevent starvation | P0 | CONFIRMED | Unit test |
| REQ-CTL-004 | Enforce maximum green time per phase | P1 | CONFIRMED | Unit test |
| REQ-CTL-005 | Support emergency vehicle priority override | P1 | CONFIRMED | Unit test + scenario test |
| REQ-CTL-006 | Implement a fixed-timer baseline controller for comparison | P0 | CONFIRMED | Unit test |
| REQ-CTL-007 | Compare adaptive control with fixed-timer control via analytics | P0 | CONFIRMED | Analytics output review |

---

## 4. Functional Requirements — Compiler

| ID | Requirement | Priority | Status | Verification |
|----|-------------|----------|--------|--------------|
| REQ-CMP-001 | Implement a domain-specific language (DSL) for traffic scenario configuration and control rules | P0 | CONFIRMED | Compiler tests |
| REQ-CMP-002 | Implement lexical analysis (tokenization) | P0 | CONFIRMED | Lexer unit tests |
| REQ-CMP-003 | Implement parsing (recursive-descent parser producing AST) | P0 | CONFIRMED | Parser unit tests |
| REQ-CMP-004 | Implement semantic analysis (type checking, validation) | P0 | CONFIRMED | Semantic analyzer tests |
| REQ-CMP-005 | Generate abstract syntax tree (AST) | P0 | CONFIRMED | AST structure tests |
| REQ-CMP-006 | Transform AST to intermediate representation (IR) | P0 | CONFIRMED | IR generation tests |
| REQ-CMP-007 | Implement IR optimization (constant folding, dead-code elimination) | P1 | CONFIRMED | Optimization tests |
| REQ-CMP-008 | Implement executor that interprets IR to configure/control the simulation | P0 | CONFIRMED | Integration tests |
| REQ-CMP-009 | Report meaningful error messages for invalid DSL programs | P1 | CONFIRMED | Error handling tests |

---

## 5. Functional Requirements — Analytics

| ID | Requirement | Priority | Status | Verification |
|----|-------------|----------|--------|--------------|
| REQ-ANL-001 | Calculate vehicle count per direction per cycle | P0 | CONFIRMED | Unit test |
| REQ-ANL-002 | Calculate average queue length per direction | P0 | CONFIRMED | Unit test |
| REQ-ANL-003 | Calculate average waiting time per vehicle | P0 | CONFIRMED | Unit test |
| REQ-ANL-004 | Calculate throughput (vehicles departing per unit time) | P0 | CONFIRMED | Unit test |
| REQ-ANL-005 | Calculate congestion index | P1 | CONFIRMED | Unit test |
| REQ-ANL-006 | Generate side-by-side comparison of adaptive vs fixed-timer control | P0 | CONFIRMED | Report review |
| REQ-ANL-007 | Export analytics data as JSON | P2 | ASSUMED | Manual test |

---

## 6. Functional Requirements — Visualization

| ID | Requirement | Priority | Status | Verification |
|----|-------------|----------|--------|--------------|
| REQ-VIZ-001 | Render traffic animation on HTML5 Canvas (roads, vehicles, signals) | P0 | CONFIRMED | Visual inspection |
| REQ-VIZ-002 | Display real-time dashboard with live metrics | P0 | CONFIRMED | Visual inspection |
| REQ-VIZ-003 | Display charts for queue length, wait time, throughput over time | P1 | CONFIRMED | Visual inspection |
| REQ-VIZ-004 | Visualize compiler pipeline (tokens → AST → IR → output) | P1 | CONFIRMED | Visual inspection |
| REQ-VIZ-005 | Provide scenario selector UI | P1 | CONFIRMED | Manual test |
| REQ-VIZ-006 | Support simulation speed controls (play, pause, speed up) | P1 | ASSUMED | Manual test |
| REQ-VIZ-007 | Color-code traffic signals (red, green, yellow) | P0 | CONFIRMED | Visual inspection |
| REQ-VIZ-008 | Display vehicle queues visually at intersection approaches | P0 | CONFIRMED | Visual inspection |

---

## 7. Non-Functional Requirements

| ID | Requirement | Priority | Status | Verification |
|----|-------------|----------|--------|--------------|
| NFR-001 | Run on a normal Windows laptop without specialized hardware | P0 | CONFIRMED | Deployment test |
| NFR-002 | Browser-based visualization (no installation beyond Node.js) | P0 | CONFIRMED | Setup test |
| NFR-003 | Visual rendering at 60 FPS | P1 | CONFIRMED | Performance test |
| NFR-004 | Simulation at 30 logical ticks per second minimum | P1 | CONFIRMED | Performance test |
| NFR-005 | Support up to 10,000 vehicle entities | P1 | ASSUMED | Load test |
| NFR-006 | Application startup under 2 seconds | P2 | ASSUMED | Manual test |
| NFR-007 | No external database required | P0 | CONFIRMED | Architecture review |
| NFR-008 | Modular architecture: compiler, simulation, control, analytics, visualization independent | P0 | CONFIRMED | Architecture review |
| NFR-009 | Comprehensive test coverage for all major components | P1 | CONFIRMED | Test suite review |
| NFR-010 | Clear documentation for architecture, DSL grammar, and usage | P1 | CONFIRMED | Documentation review |

---

## 8. Constraints

| ID | Constraint | Source |
|----|-----------|--------|
| CON-001 | Target OS: Windows | User requirement |
| CON-002 | Language: JavaScript (ES Modules) | Architectural decision |
| CON-003 | No heavyweight frameworks (React, Angular, etc.) | Architectural decision |
| CON-004 | No external database | Architectural decision |
| CON-005 | Single-intersection initial scope | Architectural decision |
| CON-006 | Solo developer | Project constraint |

---

## 9. Acceptance Criteria

The project is considered complete when:

1. A four-way intersection is simulated with vehicles spawning, queuing, and departing
2. Virtual sensors accurately detect queue length, vehicle count, and waiting time
3. The adaptive controller adjusts green time based on sensor data
4. The fixed-timer controller operates with constant cycle times
5. Analytics correctly compare adaptive vs fixed-timer performance
6. The DSL compiler processes valid programs through all pipeline stages
7. The browser visualization displays real-time traffic animation with dashboard
8. All major components have passing unit tests
9. At least five demo scenarios are packaged and runnable
10. The system runs on a normal Windows laptop at acceptable performance
