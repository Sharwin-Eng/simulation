/**
 * ANTIGRAVITY — Sensor Aggregator
 * 
 * Collects readings from all virtual sensors and provides
 * a unified snapshot of traffic conditions across all four
 * intersection approaches.
 * 
 * This is the primary interface that the traffic controller
 * consumes — it never reads individual sensors directly.
 */

import { DIRECTIONS } from '../constants.js';
import { QueueLengthSensor } from './queue-sensor.js';
import { ArrivalRateSensor } from './arrival-sensor.js';
import { WaitingTimeSensor } from './wait-sensor.js';

export class SensorAggregator {
  /**
   * @param {import('../simulation/intersection.js').Intersection} intersection
   * @param {import('../simulation/spawner.js').VehicleSpawner} spawner
   * @param {Object} [options]
   * @param {number} [options.arrivalWindow] - Arrival rate window in seconds
   */
  constructor(intersection, spawner, options = {}) {
    this.intersection = intersection;
    this.spawner = spawner;

    /** @type {Object<string, QueueLengthSensor>} */
    this.queueSensors = {};
    /** @type {Object<string, ArrivalRateSensor>} */
    this.arrivalSensors = {};
    /** @type {Object<string, WaitingTimeSensor>} */
    this.waitSensors = {};

    for (const dir of DIRECTIONS) {
      const lane = intersection.getInboundLane(dir);

      this.queueSensors[dir] = new QueueLengthSensor({ direction: dir, lane });
      this.arrivalSensors[dir] = new ArrivalRateSensor({
        direction: dir,
        lane,
        windowSize: options.arrivalWindow ?? 30,
      });
      this.waitSensors[dir] = new WaitingTimeSensor({ direction: dir, lane });
    }
  }

  /**
   * Update arrival sensors with latest spawn data.
   * Call once per tick before reading.
   * @param {number} timestamp - Current simulation time
   */
  update(timestamp) {
    for (const dir of DIRECTIONS) {
      this.arrivalSensors[dir].update(
        timestamp,
        this.spawner.spawnCounts[dir]
      );
    }
  }

  /**
   * Read a complete snapshot of all sensor data.
   * @param {number} timestamp - Current simulation time
   * @returns {SensorSnapshot}
   */
  snapshot(timestamp) {
    /** @type {SensorSnapshot} */
    const snap = { timestamp };

    for (const dir of DIRECTIONS) {
      const queue = this.queueSensors[dir].read(timestamp);
      const arrival = this.arrivalSensors[dir].read(timestamp);
      const wait = this.waitSensors[dir].read(timestamp);

      snap[dir] = {
        queueLength: queue.queueLength,
        arrivalRate: arrival.arrivalRate,
        avgWaitTime: wait.avgWaitTime,
        maxWaitTime: wait.maxWaitTime,
      };
    }

    return snap;
  }

  /**
   * Reset all sensors.
   */
  reset() {
    for (const dir of DIRECTIONS) {
      this.arrivalSensors[dir].reset();
    }
  }
}

/**
 * @typedef {Object} SensorSnapshot
 * @property {number} timestamp
 * @property {{ queueLength: number, arrivalRate: number, avgWaitTime: number, maxWaitTime: number }} north
 * @property {{ queueLength: number, arrivalRate: number, avgWaitTime: number, maxWaitTime: number }} south
 * @property {{ queueLength: number, arrivalRate: number, avgWaitTime: number, maxWaitTime: number }} east
 * @property {{ queueLength: number, arrivalRate: number, avgWaitTime: number, maxWaitTime: number }} west
 */
