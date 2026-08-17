/**
 * ANTIGRAVITY — Lane Model
 * 
 * A lane is an ordered container of vehicles.
 * Inbound lanes carry vehicles toward the intersection.
 * Outbound lanes carry vehicles away from the intersection.
 * 
 * Vehicles are maintained in order of position (closest to intersection first).
 * This ordering is essential for the car-following model: each vehicle
 * needs to know about the vehicle immediately ahead.
 */

import { LaneType, Defaults } from './constants.js';

export class Lane {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique lane identifier
   * @param {string} options.direction - Cardinal direction (north, south, east, west)
   * @param {string} options.type - LaneType.INBOUND or LaneType.OUTBOUND
   * @param {number} [options.length] - Lane length in meters
   * @param {number} [options.width] - Lane width in meters
   */
  constructor({
    id,
    direction,
    type,
    length = Defaults.ROAD_LENGTH,
    width = Defaults.LANE_WIDTH,
  }) {
    this.id = id;
    this.direction = direction;
    this.type = type;
    this.length = length;
    this.width = width;

    /** @type {import('./vehicle.js').Vehicle[]} */
    this.vehicles = [];
  }

  /**
   * Add a vehicle to this lane.
   * Vehicle is inserted in position-sorted order (descending position = closer to intersection).
   * @param {import('./vehicle.js').Vehicle} vehicle
   */
  addVehicle(vehicle) {
    this.vehicles.push(vehicle);
  }

  /**
   * Remove departed vehicles from the lane.
   * @returns {import('./vehicle.js').Vehicle[]} The removed vehicles
   */
  removeDeparted() {
    const departed = this.vehicles.filter(v => v.isDeparted);
    this.vehicles = this.vehicles.filter(v => !v.isDeparted);
    return departed;
  }

  /**
   * Sort vehicles by position descending (closest to intersection first).
   * Called after spawning or position updates to maintain order.
   */
  sortVehicles() {
    this.vehicles.sort((a, b) => b.position - a.position);
  }

  /**
   * Get the vehicle immediately ahead of the given vehicle.
   * Assumes vehicles are sorted by position descending.
   * @param {import('./vehicle.js').Vehicle} vehicle
   * @returns {import('./vehicle.js').Vehicle|null}
   */
  getVehicleAhead(vehicle) {
    const index = this.vehicles.indexOf(vehicle);
    if (index <= 0) return null; // First vehicle or not found
    return this.vehicles[index - 1];
  }

  /**
   * Get the last vehicle in the lane (furthest from intersection).
   * Used to check if there's space to spawn a new vehicle.
   * @returns {import('./vehicle.js').Vehicle|null}
   */
  getLastVehicle() {
    if (this.vehicles.length === 0) return null;
    return this.vehicles[this.vehicles.length - 1];
  }

  /**
   * Get the first vehicle in the lane (closest to intersection).
   * @returns {import('./vehicle.js').Vehicle|null}
   */
  getFirstVehicle() {
    if (this.vehicles.length === 0) return null;
    return this.vehicles[0];
  }

  /**
   * Number of vehicles currently in this lane.
   * @returns {number}
   */
  get vehicleCount() {
    return this.vehicles.length;
  }

  /**
   * Whether this is an inbound lane.
   * @returns {boolean}
   */
  get isInbound() {
    return this.type === LaneType.INBOUND;
  }

  /**
   * Check if there is enough space at the start of the lane to spawn a new vehicle.
   * @param {number} vehicleLength - Length of the vehicle to spawn
   * @param {number} minGap - Minimum gap between vehicles
   * @returns {boolean}
   */
  hasSpawnSpace(vehicleLength = Defaults.VEHICLE_LENGTH, minGap = Defaults.VEHICLE_MIN_GAP) {
    const lastVehicle = this.getLastVehicle();
    if (!lastVehicle) return true;
    return lastVehicle.position > vehicleLength + minGap;
  }
}
