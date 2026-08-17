/**
 * ANTIGRAVITY — Simulation Engine
 * 
 * The central orchestrator of the traffic simulation.
 * Coordinates the simulation loop: clock advancement, vehicle spawning,
 * vehicle movement, signal updates, and event emission.
 * 
 * The engine does NOT manage signal timing directly — that responsibility
 * belongs to the traffic controller (source/control/). The engine provides
 * hooks for the controller to read sensor data and set signal states.
 * 
 * Simulation loop per tick:
 *   1. Advance clock
 *   2. Spawn new vehicles
 *   3. Update vehicle positions
 *   4. Remove departed vehicles
 *   5. Update signal timers
 *   6. Emit tick event
 */

import { SimulationClock } from './clock.js';
import { SeededRandom } from './random.js';
import { Intersection } from './intersection.js';
import { VehicleSpawner } from './spawner.js';
import { DIRECTIONS, Defaults, VehicleState, SignalState } from './constants.js';

export class SimulationEngine {
  /**
   * @param {Object} [config] - Configuration object (matches configs/default.json structure)
   */
  constructor(config = {}) {
    const simConfig = config.simulation || {};
    const roadConfig = config.road || {};
    const vehicleConfig = config.vehicle || {};
    const signalConfig = config.signal || {};
    const arrivalConfig = config.arrival || {};

    // Core components
    this.clock = new SimulationClock(
      simConfig.tickInterval ?? Defaults.TICK_INTERVAL,
      simConfig.speedMultiplier ?? Defaults.SPEED_MULTIPLIER
    );

    this.random = new SeededRandom(
      simConfig.randomSeed ?? Defaults.RANDOM_SEED
    );

    this.intersection = new Intersection({
      roadLength: roadConfig.length ?? Defaults.ROAD_LENGTH,
      laneWidth: roadConfig.laneWidth ?? Defaults.LANE_WIDTH,
    });

    this.spawner = new VehicleSpawner({
      arrivalRates: {
        north: arrivalConfig.north ?? Defaults.ARRIVAL_RATE,
        south: arrivalConfig.south ?? Defaults.ARRIVAL_RATE,
        east: arrivalConfig.east ?? Defaults.ARRIVAL_RATE,
        west: arrivalConfig.west ?? Defaults.ARRIVAL_RATE,
      },
      random: this.random,
      emergencyProbability: simConfig.emergencyProbability ?? 0.02,
      vehicleConfig: {
        maxSpeed: vehicleConfig.maxSpeed ?? Defaults.VEHICLE_MAX_SPEED,
        acceleration: vehicleConfig.acceleration ?? Defaults.VEHICLE_ACCELERATION,
        deceleration: vehicleConfig.deceleration ?? Defaults.VEHICLE_DECELERATION,
        length: vehicleConfig.length ?? Defaults.VEHICLE_LENGTH,
        minGap: vehicleConfig.minGap ?? Defaults.VEHICLE_MIN_GAP,
      },
    });

    // Configuration references
    this.maxVehicles = simConfig.maxVehicles ?? Defaults.MAX_VEHICLES;
    this.simulationDuration = simConfig.simulationDuration ?? Defaults.SIMULATION_DURATION;
    this.vehicleMinGap = vehicleConfig.minGap ?? Defaults.VEHICLE_MIN_GAP;

    // Runtime state
    this._activeVehicles = [];     // All active (non-departed) vehicles
    this._departedVehicles = [];   // Departed vehicles (for analytics)
    this._tickListeners = [];      // Callbacks invoked after each tick
    this._running = false;
    this._tickId = null;           // For real-time loop (setInterval/setTimeout)
  }

  // ─── Tick Loop ──────────────────────────────────────────

  /**
   * Execute a single simulation tick.
   * This is the core simulation step.
   * @returns {Object} Tick result with metadata
   */
  tick() {
    const dt = this.clock.tickInterval;
    const time = this.clock.tick();

    // 1. Spawn new vehicles
    const spawned = this.spawner.spawnTick(
      dt,
      this.intersection,
      this._activeVehicles.length,
      this.maxVehicles
    );
    this._activeVehicles.push(...spawned);

    // 2. Update vehicle positions
    this._updateVehicles(dt);

    // 3. Remove departed vehicles
    const departed = this._collectDeparted();

    // 4. Update signal timers
    this.intersection.updateSignals(dt);

    // 5. Build tick result
    const result = {
      time,
      tickCount: this.clock.tickCount,
      spawned: spawned.length,
      departed: departed.length,
      activeVehicles: this._activeVehicles.length,
      totalDeparted: this._departedVehicles.length,
    };

    // 6. Notify listeners
    for (const listener of this._tickListeners) {
      listener(result);
    }

    return result;
  }

  /**
   * Update all active vehicles for one tick.
   * Processes each direction's inbound lane independently.
   * @param {number} dt - Tick interval in seconds
   * @private
   */
  _updateVehicles(dt) {
    for (const dir of DIRECTIONS) {
      const lane = this.intersection.getInboundLane(dir);
      const signal = this.intersection.getSignal(dir);
      const stopLine = this.intersection.getStopLinePosition(dir);

      // Sort vehicles so we process from front to back
      // (front vehicles have highest position)
      lane.sortVehicles();

      for (let i = 0; i < lane.vehicles.length; i++) {
        const vehicle = lane.vehicles[i];
        const vehicleAhead = i > 0 ? lane.vehicles[i - 1] : null;

        vehicle.update(dt, {
          signalGreen: signal.isGreen,
          stopLinePosition: stopLine,
          vehicleAhead,
          minGap: this.vehicleMinGap,
          laneLength: stopLine + this.intersection.getRoad(dir).length,
          currentTime: this.clock.currentTime,
        });
      }
    }
  }

  /**
   * Collect departed vehicles from all lanes.
   * Moves them from active list to departed list.
   * @returns {import('./vehicle.js').Vehicle[]}
   * @private
   */
  _collectDeparted() {
    const allDeparted = [];

    for (const dir of DIRECTIONS) {
      const lane = this.intersection.getInboundLane(dir);
      const departed = lane.removeDeparted();
      for (const v of departed) {
        v.finalizeWaitTime(this.clock.currentTime);
      }
      allDeparted.push(...departed);
    }

    // Remove from active list
    this._activeVehicles = this._activeVehicles.filter(v => !v.isDeparted);
    this._departedVehicles.push(...allDeparted);

    return allDeparted;
  }

  // ─── Real-Time Loop ─────────────────────────────────────

  /**
   * Start the simulation in a real-time loop.
   * Ticks are scheduled according to the clock's speed multiplier.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this.clock.resume();
    this._scheduleNextTick();
  }

  /**
   * Stop the real-time loop.
   */
  stop() {
    this._running = false;
    this.clock.pause();
    if (this._tickId !== null) {
      clearTimeout(this._tickId);
      this._tickId = null;
    }
  }

  /**
   * Schedule the next tick based on the speed multiplier.
   * @private
   */
  _scheduleNextTick() {
    if (!this._running) return;

    // Check duration limit
    if (this.clock.currentTime >= this.simulationDuration) {
      this.stop();
      return;
    }

    this._tickId = setTimeout(() => {
      this.tick();
      this._scheduleNextTick();
    }, this.clock.realTickIntervalMs);
  }

  // ─── Event System ───────────────────────────────────────

  /**
   * Register a callback to be invoked after each tick.
   * @param {Function} callback - Function receiving tick result object
   */
  onTick(callback) {
    this._tickListeners.push(callback);
  }

  /**
   * Remove a tick listener.
   * @param {Function} callback
   */
  offTick(callback) {
    this._tickListeners = this._tickListeners.filter(cb => cb !== callback);
  }

  // ─── State Access ───────────────────────────────────────

  /**
   * Get all currently active (non-departed) vehicles.
   * @returns {import('./vehicle.js').Vehicle[]}
   */
  get activeVehicles() {
    return this._activeVehicles;
  }

  /**
   * Get all departed vehicles (for analytics).
   * @returns {import('./vehicle.js').Vehicle[]}
   */
  get departedVehicles() {
    return this._departedVehicles;
  }

  /**
   * Whether the simulation is currently running.
   * @returns {boolean}
   */
  get running() {
    return this._running;
  }

  /**
   * Current simulation time in seconds.
   * @returns {number}
   */
  get currentTime() {
    return this.clock.currentTime;
  }

  // ─── Lifecycle ──────────────────────────────────────────

  /**
   * Reset the entire simulation to initial state.
   */
  reset() {
    this.stop();
    this.clock.reset();
    this.random.reset();
    this.intersection.reset();
    this.spawner.reset();
    this._activeVehicles = [];
    this._departedVehicles = [];
  }

  /**
   * Serialize simulation state for debugging.
   * @returns {Object}
   */
  toJSON() {
    return {
      time: this.clock.currentTime,
      tickCount: this.clock.tickCount,
      activeVehicles: this._activeVehicles.length,
      departedVehicles: this._departedVehicles.length,
      intersection: this.intersection.toJSON(),
    };
  }
}
