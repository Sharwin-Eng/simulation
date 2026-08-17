/**
 * ANTIGRAVITY — Road Model
 * 
 * A road extends from the simulation boundary to the intersection
 * in one cardinal direction. Each road has an inbound lane (vehicles
 * approaching the intersection) and an outbound lane (vehicles departing).
 */

import { Lane } from './lane.js';
import { LaneType, Defaults } from './constants.js';

export class Road {
  /**
   * @param {Object} options
   * @param {string} options.direction - Cardinal direction (north, south, east, west)
   * @param {number} [options.length] - Road length in meters
   * @param {number} [options.laneWidth] - Lane width in meters
   */
  constructor({
    direction,
    length = Defaults.ROAD_LENGTH,
    laneWidth = Defaults.LANE_WIDTH,
  }) {
    this.id = `road_${direction}`;
    this.direction = direction;
    this.length = length;
    this.laneWidth = laneWidth;

    this.inboundLane = new Lane({
      id: `${direction}_inbound`,
      direction,
      type: LaneType.INBOUND,
      length,
      width: laneWidth,
    });

    this.outboundLane = new Lane({
      id: `${direction}_outbound`,
      direction,
      type: LaneType.OUTBOUND,
      length,
      width: laneWidth,
    });
  }

  /**
   * Get the inbound lane (vehicles approaching intersection).
   * @returns {Lane}
   */
  getInbound() {
    return this.inboundLane;
  }

  /**
   * Get the outbound lane (vehicles departing intersection).
   * @returns {Lane}
   */
  getOutbound() {
    return this.outboundLane;
  }
}
