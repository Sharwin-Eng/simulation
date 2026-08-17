/**
 * ANTIGRAVITY — Simulation Module Index
 * 
 * Re-exports all simulation components for convenient importing.
 */

export { SimulationEngine } from './engine.js';
export { SimulationClock } from './clock.js';
export { SeededRandom } from './random.js';
export { Intersection } from './intersection.js';
export { Road } from './road.js';
export { Lane } from './lane.js';
export { TrafficSignal } from './signal.js';
export { Vehicle, resetVehicleIds } from './vehicle.js';
export { VehicleSpawner } from './spawner.js';
export {
  Direction,
  DIRECTIONS,
  LaneType,
  SignalState,
  VehicleState,
  VehicleType,
  Phase,
  PhaseState,
  ControllerMode,
  Defaults,
  oppositeDirection,
} from './constants.js';
