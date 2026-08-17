/**
 * ANTIGRAVITY — Queue Length Sensor
 * 
 * Counts the number of vehicles in QUEUED state on a given
 * inbound lane. This is the primary demand signal for the
 * adaptive traffic controller.
 */

import { VehicleState } from '../constants.js';

export class QueueLengthSensor {
  /**
   * @param {Object} options
   * @param {string} options.direction - Cardinal direction this sensor monitors
   * @param {import('../simulation/lane.js').Lane} options.lane - The inbound lane to observe
   */
  constructor({ direction, lane }) {
    this.id = `queue_sensor_${direction}`;
    this.direction = direction;
    this.lane = lane;
  }

  /**
   * Read the current queue length.
   * @param {number} timestamp - Current simulation time
   * @returns {{ direction: string, queueLength: number, timestamp: number }}
   */
  read(timestamp) {
    const queueLength = this.lane.vehicles.filter(
      v => v.state === VehicleState.QUEUED
    ).length;

    return {
      direction: this.direction,
      queueLength,
      timestamp,
    };
  }
}
