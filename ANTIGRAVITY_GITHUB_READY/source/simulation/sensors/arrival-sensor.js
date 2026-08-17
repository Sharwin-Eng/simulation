/**
 * ANTIGRAVITY — Arrival Rate Sensor
 * 
 * Measures the number of vehicles entering an inbound lane
 * per time window. Uses a sliding window to smooth readings.
 * 
 * The sensor tracks vehicle count snapshots and computes
 * the arrival rate as new vehicles observed per minute.
 */

export class ArrivalRateSensor {
  /**
   * @param {Object} options
   * @param {string} options.direction - Cardinal direction this sensor monitors
   * @param {import('../simulation/lane.js').Lane} options.lane - The inbound lane to observe
   * @param {number} [options.windowSize] - Sliding window size in seconds (default 30)
   */
  constructor({ direction, lane, windowSize = 30 }) {
    this.id = `arrival_sensor_${direction}`;
    this.direction = direction;
    this.lane = lane;
    this.windowSize = windowSize;

    // Track timestamped arrivals within the window
    this._arrivals = [];
    this._lastVehicleCount = 0;
  }

  /**
   * Record arrivals observed at this tick.
   * Should be called each tick before read().
   * @param {number} timestamp - Current simulation time
   * @param {number} totalSpawnedForDirection - Cumulative spawned count for this direction
   */
  update(timestamp, totalSpawnedForDirection) {
    const newArrivals = totalSpawnedForDirection - this._lastVehicleCount;
    if (newArrivals > 0) {
      this._arrivals.push({ timestamp, count: newArrivals });
    }
    this._lastVehicleCount = totalSpawnedForDirection;

    // Evict entries older than the window
    const cutoff = timestamp - this.windowSize;
    this._arrivals = this._arrivals.filter(a => a.timestamp >= cutoff);
  }

  /**
   * Read the current arrival rate in vehicles per minute.
   * @param {number} timestamp - Current simulation time
   * @returns {{ direction: string, arrivalRate: number, timestamp: number }}
   */
  read(timestamp) {
    const totalInWindow = this._arrivals.reduce((sum, a) => sum + a.count, 0);
    // Scale to vehicles per minute
    const windowDuration = Math.min(this.windowSize, timestamp);
    const arrivalRate = windowDuration > 0
      ? (totalInWindow / windowDuration) * 60
      : 0;

    return {
      direction: this.direction,
      arrivalRate: Math.round(arrivalRate * 100) / 100,
      timestamp,
    };
  }

  /**
   * Reset the sensor state.
   */
  reset() {
    this._arrivals = [];
    this._lastVehicleCount = 0;
  }
}
