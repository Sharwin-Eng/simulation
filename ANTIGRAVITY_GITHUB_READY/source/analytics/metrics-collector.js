/**
 * ANTIGRAVITY — Metrics Collector
 * 
 * Collects per-cycle and per-tick metrics from the simulation.
 * Tracks vehicle count, queue length, waiting time, throughput,
 * and congestion index over time.
 * 
 * The collector is a passive observer — it reads simulation state
 * but never modifies it.
 */

import { DIRECTIONS, Defaults } from '../simulation/constants.js';

export class MetricsCollector {
  /**
   * @param {Object} [options]
   * @param {number} [options.roadLength] - Lane length for capacity calculation
   * @param {number} [options.vehicleLength] - Vehicle length for capacity calculation
   * @param {number} [options.minGap] - Minimum gap for capacity calculation
   */
  constructor(options = {}) {
    this.roadLength = options.roadLength ?? Defaults.ROAD_LENGTH;
    this.vehicleLength = options.vehicleLength ?? Defaults.VEHICLE_LENGTH;
    this.minGap = options.minGap ?? Defaults.VEHICLE_MIN_GAP;

    // Per-lane capacity: how many vehicles can physically fit
    this.laneCapacity = Math.floor(
      this.roadLength / (this.vehicleLength + this.minGap)
    );
    // Total capacity across all 4 inbound lanes
    this.totalCapacity = this.laneCapacity * 4;

    /** @type {CycleMetrics[]} */
    this.cycleHistory = [];

    /** @type {TickMetrics[]} */
    this.tickHistory = [];

    // Running totals for current cycle
    this._cycleStart = 0;
    this._cycleDepartedCount = 0;
    this._cycleNumber = 0;
  }

  /**
   * Record metrics for a single simulation tick.
   * @param {import('../simulation/sensors/aggregator.js').SensorSnapshot} sensorSnapshot
   * @param {Object} tickResult - From SimulationEngine.tick()
   * @param {Object} controllerState - From controller.toJSON()
   */
  recordTick(sensorSnapshot, tickResult, controllerState) {
    const tick = {
      timestamp: tickResult.time,
      tickCount: tickResult.tickCount,
      activeVehicles: tickResult.activeVehicles,
      totalDeparted: tickResult.totalDeparted,
      spawned: tickResult.spawned,
      departed: tickResult.departed,
      queueLength: {},
      avgWaitTime: {},
      congestionIndex: 0,
      controllerPhase: controllerState?.currentPhase ?? null,
      controllerState: controllerState?.phaseState ?? null,
    };

    let totalQueued = 0;
    for (const dir of DIRECTIONS) {
      const dirData = sensorSnapshot[dir];
      tick.queueLength[dir] = dirData?.queueLength ?? 0;
      tick.avgWaitTime[dir] = dirData?.avgWaitTime ?? 0;
      totalQueued += tick.queueLength[dir];
    }

    // Congestion index: proportion of capacity used by queued vehicles
    tick.congestionIndex = this.totalCapacity > 0
      ? Math.min(1, totalQueued / this.totalCapacity)
      : 0;

    this.tickHistory.push(tick);
    this._cycleDepartedCount += tickResult.departed;
  }

  /**
   * Record the end of a signal cycle.
   * Called when the controller completes a full NS+EW cycle.
   * @param {import('../simulation/sensors/aggregator.js').SensorSnapshot} sensorSnapshot
   * @param {number} timestamp - Current simulation time
   * @param {Object} greenTimes - From controller.getGreenTimes()
   */
  recordCycle(sensorSnapshot, timestamp, greenTimes) {
    this._cycleNumber++;

    const cycle = {
      cycleNumber: this._cycleNumber,
      timestamp,
      duration: timestamp - this._cycleStart,
      vehicleCount: {},
      queueLength: {},
      avgWaitTime: {},
      maxWaitTime: {},
      throughput: {},
      greenTime: greenTimes ?? { phaseNS: 0, phaseEW: 0 },
      totalDeparted: this._cycleDepartedCount,
    };

    let totalThroughput = 0;
    for (const dir of DIRECTIONS) {
      const dirData = sensorSnapshot[dir];
      cycle.queueLength[dir] = dirData?.queueLength ?? 0;
      cycle.avgWaitTime[dir] = dirData?.avgWaitTime ?? 0;
      cycle.maxWaitTime[dir] = dirData?.maxWaitTime ?? 0;
    }

    // Throughput = departed vehicles this cycle / cycle duration in minutes
    const cycleDurationMinutes = cycle.duration / 60;
    if (cycleDurationMinutes > 0) {
      cycle.throughput.total = Math.round(this._cycleDepartedCount / cycleDurationMinutes);
    } else {
      cycle.throughput.total = 0;
    }

    this.cycleHistory.push(cycle);

    // Reset cycle counters
    this._cycleStart = timestamp;
    this._cycleDepartedCount = 0;
  }

  /**
   * Compute aggregate metrics across all recorded data.
   * @returns {AggregateMetrics}
   */
  computeAggregate() {
    if (this.tickHistory.length === 0) {
      return this._emptyAggregate();
    }

    const lastTick = this.tickHistory[this.tickHistory.length - 1];
    const totalVehicles = lastTick.activeVehicles + lastTick.totalDeparted;
    const totalDeparted = lastTick.totalDeparted;
    const duration = lastTick.timestamp;

    // Average wait time across all tick readings
    let totalWaitSum = 0;
    let totalWaitCount = 0;
    let maxWait = 0;

    for (const tick of this.tickHistory) {
      for (const dir of DIRECTIONS) {
        if (tick.avgWaitTime[dir] > 0) {
          totalWaitSum += tick.avgWaitTime[dir];
          totalWaitCount++;
        }
        if (tick.avgWaitTime[dir] > maxWait) {
          maxWait = tick.avgWaitTime[dir];
        }
      }
    }

    // Average congestion
    const avgCongestion = this.tickHistory.reduce(
      (sum, t) => sum + t.congestionIndex, 0
    ) / this.tickHistory.length;

    return {
      totalVehicles,
      totalDeparted,
      duration: Math.round(duration * 100) / 100,
      overallAvgWaitTime: totalWaitCount > 0
        ? Math.round((totalWaitSum / totalWaitCount) * 100) / 100
        : 0,
      overallMaxWaitTime: Math.round(maxWait * 100) / 100,
      overallThroughput: duration > 0
        ? Math.round((totalDeparted / (duration / 60)) * 100) / 100
        : 0,
      congestionIndex: Math.round(avgCongestion * 1000) / 1000,
      cyclesCompleted: this._cycleNumber,
    };
  }

  /**
   * @returns {AggregateMetrics}
   * @private
   */
  _emptyAggregate() {
    return {
      totalVehicles: 0,
      totalDeparted: 0,
      duration: 0,
      overallAvgWaitTime: 0,
      overallMaxWaitTime: 0,
      overallThroughput: 0,
      congestionIndex: 0,
      cyclesCompleted: 0,
    };
  }

  /**
   * Reset all collected data.
   */
  reset() {
    this.cycleHistory = [];
    this.tickHistory = [];
    this._cycleStart = 0;
    this._cycleDepartedCount = 0;
    this._cycleNumber = 0;
  }

  /**
   * Export all data as a plain object (for JSON serialization).
   * @returns {Object}
   */
  export() {
    return {
      aggregate: this.computeAggregate(),
      cycles: this.cycleHistory,
      // Only export sampled ticks (every 10th) to reduce size
      ticks: this.tickHistory.filter((_, i) => i % 10 === 0),
    };
  }
}

/**
 * @typedef {Object} AggregateMetrics
 * @property {number} totalVehicles
 * @property {number} totalDeparted
 * @property {number} duration
 * @property {number} overallAvgWaitTime
 * @property {number} overallMaxWaitTime
 * @property {number} overallThroughput
 * @property {number} congestionIndex
 * @property {number} cyclesCompleted
 */

/**
 * @typedef {Object} CycleMetrics
 * @property {number} cycleNumber
 * @property {number} timestamp
 * @property {number} duration
 * @property {Object} vehicleCount
 * @property {Object} queueLength
 * @property {Object} avgWaitTime
 * @property {Object} maxWaitTime
 * @property {Object} throughput
 * @property {Object} greenTime
 * @property {number} totalDeparted
 */
