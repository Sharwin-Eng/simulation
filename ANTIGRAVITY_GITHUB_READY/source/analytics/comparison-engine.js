/**
 * ANTIGRAVITY — Comparison Engine
 * 
 * Runs the same traffic scenario twice — once with adaptive control,
 * once with fixed-timer control — and produces a comparative report.
 * 
 * This is the core analytical tool that quantifies the benefit
 * of adaptive signal control.
 */

import { SimulationEngine } from '../simulation/engine.js';
import { SensorAggregator } from '../simulation/sensors/aggregator.js';
import { FixedTimerController } from '../control/fixed-controller.js';
import { AdaptiveController } from '../control/adaptive-controller.js';
import { MetricsCollector } from './metrics-collector.js';
import { DIRECTIONS } from '../simulation/constants.js';

export class ComparisonEngine {
  /**
   * Run a comparison between adaptive and fixed-timer control.
   * 
   * @param {Object} config - Simulation configuration (from configs/*.json)
   * @param {number} [ticks] - Number of ticks to simulate (default: duration / tickInterval)
   * @returns {ComparisonReport}
   */
  static compare(config, ticks) {
    const simConfig = config.simulation || {};
    const tickInterval = simConfig.tickInterval ?? 0.1;
    const duration = simConfig.simulationDuration ?? 300;
    const totalTicks = ticks ?? Math.floor(duration / tickInterval);

    // Run with fixed-timer control
    const fixedResult = ComparisonEngine._runScenario(config, totalTicks, 'fixed');

    // Run with adaptive control
    const adaptiveResult = ComparisonEngine._runScenario(config, totalTicks, 'adaptive');

    // Compute improvement percentages
    const improvement = {};

    if (fixedResult.overallAvgWaitTime > 0) {
      improvement.avgWaitTimeReduction = Math.round(
        ((fixedResult.overallAvgWaitTime - adaptiveResult.overallAvgWaitTime) /
          fixedResult.overallAvgWaitTime) * 10000
      ) / 100;
    } else {
      improvement.avgWaitTimeReduction = 0;
    }

    if (fixedResult.overallThroughput > 0) {
      improvement.throughputIncrease = Math.round(
        ((adaptiveResult.overallThroughput - fixedResult.overallThroughput) /
          fixedResult.overallThroughput) * 10000
      ) / 100;
    } else {
      improvement.throughputIncrease = 0;
    }

    if (fixedResult.congestionIndex > 0) {
      improvement.congestionReduction = Math.round(
        ((fixedResult.congestionIndex - adaptiveResult.congestionIndex) /
          fixedResult.congestionIndex) * 10000
      ) / 100;
    } else {
      improvement.congestionReduction = 0;
    }

    return {
      config: {
        duration,
        ticks: totalTicks,
        arrival: config.arrival || {},
      },
      fixed: fixedResult,
      adaptive: adaptiveResult,
      improvement,
    };
  }

  /**
   * Run a single scenario with a specific controller type.
   * @param {Object} config
   * @param {number} totalTicks
   * @param {string} controllerType - 'fixed' or 'adaptive'
   * @returns {Object} Aggregate metrics
   * @private
   */
  static _runScenario(config, totalTicks, controllerType) {
    const engine = new SimulationEngine(config);
    const signalConfig = config.signal || {};

    // Create sensor aggregator
    const sensors = new SensorAggregator(engine.intersection, engine.spawner);

    // Create controller
    let controller;
    if (controllerType === 'fixed') {
      controller = new FixedTimerController(engine.intersection, {
        greenTime: signalConfig.fixedGreenTime,
        yellowTime: signalConfig.yellowTime,
        allRedTime: signalConfig.allRedTime,
      });
    } else {
      controller = new AdaptiveController(engine.intersection, {
        minGreen: signalConfig.minGreenTime,
        maxGreen: signalConfig.maxGreenTime,
        yellowTime: signalConfig.yellowTime,
        allRedTime: signalConfig.allRedTime,
      });
    }

    // Create metrics collector
    const metrics = new MetricsCollector({
      roadLength: config.road?.length,
      vehicleLength: config.vehicle?.length,
      minGap: config.vehicle?.minGap,
    });

    // Track controller cycles for cycle recording
    let lastCycleCount = 0;

    // Run simulation
    for (let i = 0; i < totalTicks; i++) {
      const tickResult = engine.tick();

      // Update sensors
      sensors.update(engine.currentTime);
      const snapshot = sensors.snapshot(engine.currentTime);

      // Update controller
      controller.update(engine.clock.tickInterval, snapshot);

      // Record tick metrics
      metrics.recordTick(snapshot, tickResult, controller.toJSON());

      // Record cycle if controller completed one
      if (controller.cycleCount > lastCycleCount) {
        metrics.recordCycle(snapshot, engine.currentTime, controller.getGreenTimes());
        lastCycleCount = controller.cycleCount;
      }
    }

    return metrics.computeAggregate();
  }
}

/**
 * @typedef {Object} ComparisonReport
 * @property {Object} config - Scenario configuration summary
 * @property {Object} fixed - Aggregate metrics for fixed-timer control
 * @property {Object} adaptive - Aggregate metrics for adaptive control
 * @property {Object} improvement - Percentage improvements
 * @property {number} improvement.avgWaitTimeReduction
 * @property {number} improvement.throughputIncrease
 * @property {number} improvement.congestionReduction
 */
