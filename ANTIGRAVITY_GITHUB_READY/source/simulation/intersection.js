/**
 * ANTIGRAVITY — Intersection Model
 * 
 * Represents a four-way signalized intersection.
 * Contains four roads (N, S, E, W) and four traffic signals.
 * 
 * The intersection is the central coordination point:
 * - Roads radiate outward from the intersection center.
 * - Signals control inbound traffic for each approach.
 * - The stop line is at the end of each inbound lane (position = lane length).
 */

import { Road } from './road.js';
import { TrafficSignal } from './signal.js';
import { Direction, DIRECTIONS, Defaults } from './constants.js';

export class Intersection {
  /**
   * @param {Object} [options]
   * @param {string} [options.id] - Intersection identifier
   * @param {number} [options.roadLength] - Length of each approach road
   * @param {number} [options.laneWidth] - Width of each lane
   */
  constructor({
    id = 'main',
    roadLength = Defaults.ROAD_LENGTH,
    laneWidth = Defaults.LANE_WIDTH,
  } = {}) {
    this.id = id;

    // Create four roads
    /** @type {Object<string, Road>} */
    this.roads = {};
    for (const dir of DIRECTIONS) {
      this.roads[dir] = new Road({
        direction: dir,
        length: roadLength,
        laneWidth,
      });
    }

    // Create four traffic signals (one per inbound approach)
    /** @type {Object<string, TrafficSignal>} */
    this.signals = {};
    for (const dir of DIRECTIONS) {
      this.signals[dir] = new TrafficSignal({ direction: dir });
    }
  }

  /**
   * Get the road for a given direction.
   * @param {string} direction
   * @returns {Road}
   */
  getRoad(direction) {
    return this.roads[direction];
  }

  /**
   * Get the inbound lane for a given direction.
   * @param {string} direction
   * @returns {import('./lane.js').Lane}
   */
  getInboundLane(direction) {
    return this.roads[direction].inboundLane;
  }

  /**
   * Get the outbound lane for a given direction.
   * @param {string} direction
   * @returns {import('./lane.js').Lane}
   */
  getOutboundLane(direction) {
    return this.roads[direction].outboundLane;
  }

  /**
   * Get the traffic signal for a given direction.
   * @param {string} direction
   * @returns {TrafficSignal}
   */
  getSignal(direction) {
    return this.signals[direction];
  }

  /**
   * Get the stop line position for a given direction.
   * The stop line is at the end of the inbound lane.
   * @param {string} direction
   * @returns {number}
   */
  getStopLinePosition(direction) {
    return this.roads[direction].inboundLane.length;
  }

  /**
   * Get all inbound lanes.
   * @returns {import('./lane.js').Lane[]}
   */
  getAllInboundLanes() {
    return DIRECTIONS.map(dir => this.roads[dir].inboundLane);
  }

  /**
   * Get all signals.
   * @returns {TrafficSignal[]}
   */
  getAllSignals() {
    return DIRECTIONS.map(dir => this.signals[dir]);
  }

  /**
   * Update all signal timers by one tick.
   * @param {number} dt - Tick interval in seconds
   */
  updateSignals(dt) {
    for (const dir of DIRECTIONS) {
      this.signals[dir].update(dt);
    }
  }

  /**
   * Reset all signals and clear all vehicles from all lanes.
   */
  reset() {
    for (const dir of DIRECTIONS) {
      this.signals[dir].reset();
      this.roads[dir].inboundLane.vehicles = [];
      this.roads[dir].outboundLane.vehicles = [];
    }
  }

  /**
   * Serialize intersection state for debugging.
   * @returns {Object}
   */
  toJSON() {
    const state = { id: this.id, roads: {}, signals: {} };
    for (const dir of DIRECTIONS) {
      state.roads[dir] = {
        inbound: this.roads[dir].inboundLane.vehicleCount,
        outbound: this.roads[dir].outboundLane.vehicleCount,
      };
      state.signals[dir] = this.signals[dir].toJSON();
    }
    return state;
  }
}
