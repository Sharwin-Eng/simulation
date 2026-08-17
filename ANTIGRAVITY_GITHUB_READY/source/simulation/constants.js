/**
 * ANTIGRAVITY — Constants and Enumerations
 * 
 * Centralizes all simulation constants, directions, states, and
 * shared enumerations. Single source of truth for magic values.
 */

// ─── Directions ───────────────────────────────────────────
export const Direction = Object.freeze({
  NORTH: 'north',
  SOUTH: 'south',
  EAST: 'east',
  WEST: 'west',
});

export const DIRECTIONS = Object.freeze([
  Direction.NORTH,
  Direction.SOUTH,
  Direction.EAST,
  Direction.WEST,
]);

/**
 * Returns the opposite direction.
 * North ↔ South, East ↔ West.
 * @param {string} direction
 * @returns {string}
 */
export function oppositeDirection(direction) {
  switch (direction) {
    case Direction.NORTH: return Direction.SOUTH;
    case Direction.SOUTH: return Direction.NORTH;
    case Direction.EAST:  return Direction.WEST;
    case Direction.WEST:  return Direction.EAST;
    default: throw new Error(`Invalid direction: ${direction}`);
  }
}

// ─── Lane Types ───────────────────────────────────────────
export const LaneType = Object.freeze({
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
});

// ─── Signal States ────────────────────────────────────────
export const SignalState = Object.freeze({
  RED: 'red',
  GREEN: 'green',
  YELLOW: 'yellow',
});

// ─── Vehicle States ───────────────────────────────────────
export const VehicleState = Object.freeze({
  APPROACHING: 'approaching',
  QUEUED: 'queued',
  CROSSING: 'crossing',
  DEPARTED: 'departed',
});

// ─── Vehicle Types ────────────────────────────────────────
export const VehicleType = Object.freeze({
  NORMAL: 'normal',
  EMERGENCY: 'emergency',
});

// ─── Phase Names ──────────────────────────────────────────
export const Phase = Object.freeze({
  NS: 'north_south',   // North-South green
  EW: 'east_west',     // East-West green
});

// ─── Phase Transition States ──────────────────────────────
export const PhaseState = Object.freeze({
  GREEN: 'green',
  YELLOW: 'yellow',
  ALL_RED: 'all_red',
});

// ─── Controller Modes ─────────────────────────────────────
export const ControllerMode = Object.freeze({
  FIXED: 'fixed',
  ADAPTIVE: 'adaptive',
});

// ─── Default Values ───────────────────────────────────────
export const Defaults = Object.freeze({
  TICK_INTERVAL: 0.1,         // seconds per tick
  ROAD_LENGTH: 300,           // meters
  LANE_WIDTH: 3.5,            // meters
  VEHICLE_LENGTH: 4.5,        // meters
  VEHICLE_MAX_SPEED: 13.9,    // m/s (≈ 50 km/h)
  VEHICLE_ACCELERATION: 2.6,  // m/s²
  VEHICLE_DECELERATION: 4.5,  // m/s²
  VEHICLE_MIN_GAP: 2.0,       // meters (bumper-to-bumper gap)
  MIN_GREEN_TIME: 10,         // seconds
  MAX_GREEN_TIME: 60,         // seconds
  YELLOW_TIME: 3,             // seconds
  ALL_RED_TIME: 2,            // seconds
  FIXED_GREEN_TIME: 30,       // seconds
  ARRIVAL_RATE: 20,           // vehicles per minute per direction
  RANDOM_SEED: 42,
  SPEED_MULTIPLIER: 1,
  MAX_VEHICLES: 10000,
  SIMULATION_DURATION: 300,   // seconds
});
