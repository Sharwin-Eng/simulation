/**
 * ANTIGRAVITY — Vehicle Spawner
 * 
 * Responsible for creating vehicles at the start of inbound lanes
 * based on configurable arrival rates per direction.
 * 
 * Spawning uses a probabilistic model: each tick, a vehicle is spawned
 * with probability = arrivalRate * tickInterval / 60.
 * This produces the desired average vehicles-per-minute rate
 * with natural stochastic variation.
 */

import { Vehicle, resetVehicleIds } from './vehicle.js';
import { VehicleType, DIRECTIONS, Defaults } from './constants.js';

export class VehicleSpawner {
  /**
   * @param {Object} options
   * @param {Object<string, number>} options.arrivalRates - Vehicles per minute per direction
   * @param {import('./random.js').SeededRandom} options.random - Seeded RNG
   * @param {number} [options.emergencyProbability] - Chance that a spawned vehicle is emergency (0-1)
   * @param {Object} [options.vehicleConfig] - Vehicle configuration overrides
   */
  constructor({
    arrivalRates = {},
    random,
    emergencyProbability = 0.02,
    vehicleConfig = {},
  }) {
    this.random = random;
    this.emergencyProbability = emergencyProbability;
    this.vehicleConfig = vehicleConfig;

    // Set arrival rates with defaults
    this.arrivalRates = {};
    for (const dir of DIRECTIONS) {
      this.arrivalRates[dir] = arrivalRates[dir] ?? Defaults.ARRIVAL_RATE;
    }

    // Track total spawned per direction (for analytics)
    this.spawnCounts = {};
    for (const dir of DIRECTIONS) {
      this.spawnCounts[dir] = 0;
    }
  }

  /**
   * Attempt to spawn vehicles for one simulation tick.
   * Returns an array of newly created vehicles (may be empty).
   * 
   * @param {number} dt - Tick interval in seconds
   * @param {import('./intersection.js').Intersection} intersection - The intersection model
   * @param {number} totalVehicles - Current total active vehicles (for max cap)
   * @param {number} [maxVehicles] - Maximum allowed vehicles
   * @returns {import('./vehicle.js').Vehicle[]} Newly spawned vehicles
   */
  spawnTick(dt, intersection, totalVehicles, maxVehicles = Defaults.MAX_VEHICLES) {
    const spawned = [];

    for (const dir of DIRECTIONS) {
      if (totalVehicles + spawned.length >= maxVehicles) break;

      // Probability of spawning this tick = rate * dt / 60
      const probability = (this.arrivalRates[dir] * dt) / 60;

      if (this.random.chance(probability)) {
        const lane = intersection.getInboundLane(dir);

        // Check if there's space at the lane entrance
        if (!lane.hasSpawnSpace(
          this.vehicleConfig.length ?? Defaults.VEHICLE_LENGTH,
          this.vehicleConfig.minGap ?? Defaults.VEHICLE_MIN_GAP
        )) {
          continue; // Lane entrance is blocked
        }

        // Determine vehicle type
        const type = this.random.chance(this.emergencyProbability)
          ? VehicleType.EMERGENCY
          : VehicleType.NORMAL;

        const vehicle = new Vehicle({
          type,
          direction: dir,
          maxSpeed: this.vehicleConfig.maxSpeed ?? Defaults.VEHICLE_MAX_SPEED,
          acceleration: this.vehicleConfig.acceleration ?? Defaults.VEHICLE_ACCELERATION,
          deceleration: this.vehicleConfig.deceleration ?? Defaults.VEHICLE_DECELERATION,
          length: this.vehicleConfig.length ?? Defaults.VEHICLE_LENGTH,
        });

        lane.addVehicle(vehicle);
        this.spawnCounts[dir]++;
        spawned.push(vehicle);
      }
    }

    return spawned;
  }

  /**
   * Manually spawn a vehicle of a specific type.
   * @param {import('./intersection.js').Intersection} intersection
   * @param {string} direction
   * @param {string} [type] - VehicleType (default NORMAL)
   * @param {number} [position] - Initial lane position
   * @returns {import('./vehicle.js').Vehicle}
   */
  spawnVehicle(intersection, direction, type = VehicleType.NORMAL, position = 0) {
    const lane = intersection.getInboundLane(direction);
    const vehicle = new Vehicle({
      type,
      direction,
      maxSpeed: this.vehicleConfig.maxSpeed ?? Defaults.VEHICLE_MAX_SPEED,
      acceleration: this.vehicleConfig.acceleration ?? Defaults.VEHICLE_ACCELERATION,
      deceleration: this.vehicleConfig.deceleration ?? Defaults.VEHICLE_DECELERATION,
      length: this.vehicleConfig.length ?? Defaults.VEHICLE_LENGTH,
    });
    vehicle.position = position;
    lane.addVehicle(vehicle);
    this.spawnCounts[direction]++;
    return vehicle;
  }

  /**
   * Update the arrival rate for a specific direction.
   * @param {string} direction
   * @param {number} rate - Vehicles per minute
   */
  setArrivalRate(direction, rate) {
    this.arrivalRates[direction] = Math.max(0, rate);
  }

  /**
   * Reset spawn counts and vehicle ID counter.
   */
  reset() {
    for (const dir of DIRECTIONS) {
      this.spawnCounts[dir] = 0;
    }
    resetVehicleIds();
  }

  /**
   * Get total vehicles spawned.
   * @returns {number}
   */
  get totalSpawned() {
    return Object.values(this.spawnCounts).reduce((sum, c) => sum + c, 0);
  }
}
