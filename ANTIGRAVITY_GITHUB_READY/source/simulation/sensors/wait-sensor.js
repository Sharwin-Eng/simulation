/**
 * ANTIGRAVITY — Waiting Time Sensor
 * 
 * Tracks the average and maximum waiting time of queued vehicles
 * on a given inbound lane. Provides real-time wait statistics
 * that the controller uses to detect starvation conditions.
 */

import { VehicleState } from '../constants.js';

export class WaitingTimeSensor {
  /**
   * @param {Object} options
   * @param {string} options.direction - Cardinal direction this sensor monitors
   * @param {import('../simulation/lane.js').Lane} options.lane - The inbound lane to observe
   */
  constructor({ direction, lane }) {
    this.id = `wait_sensor_${direction}`;
    this.direction = direction;
    this.lane = lane;
  }

  /**
   * Read current waiting time statistics.
   * @param {number} timestamp - Current simulation time
   * @returns {{ direction: string, avgWaitTime: number, maxWaitTime: number, timestamp: number }}
   */
  read(timestamp) {
    const queued = this.lane.vehicles.filter(
      v => v.state === VehicleState.QUEUED
    );

    if (queued.length === 0) {
      return {
        direction: this.direction,
        avgWaitTime: 0,
        maxWaitTime: 0,
        timestamp,
      };
    }

    let totalWait = 0;
    let maxWait = 0;

    for (const v of queued) {
      // Current wait = accumulated wait + time since last queue entry
      let currentWait = v.totalWaitTime;
      if (v.waitStartTime >= 0) {
        currentWait += timestamp - v.waitStartTime;
      }
      totalWait += currentWait;
      if (currentWait > maxWait) maxWait = currentWait;
    }

    return {
      direction: this.direction,
      avgWaitTime: Math.round((totalWait / queued.length) * 100) / 100,
      maxWaitTime: Math.round(maxWait * 100) / 100,
      timestamp,
    };
  }
}
