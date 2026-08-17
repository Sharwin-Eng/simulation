/**
 * ANTIGRAVITY — Adaptive Traffic Controller
 * 
 * Dynamically adjusts green-light duration based on real-time
 * sensor data. Green time is allocated proportionally to demand
 * (queue length) from each phase's approaches.
 * 
 * Key features:
 * - Demand-proportional green allocation
 * - Minimum green time (starvation prevention)
 * - Maximum green time cap
 * - Emergency vehicle priority override
 * 
 * Algorithm:
 *   demandNS = queueLength(N) + queueLength(S)
 *   demandEW = queueLength(E) + queueLength(W)
 *   totalDemand = demandNS + demandEW
 *   greenNS = clamp(demandNS/totalDemand * totalGreenBudget, minGreen, maxGreen)
 *   greenEW = clamp(demandEW/totalDemand * totalGreenBudget, minGreen, maxGreen)
 * 
 * Phase sequence mirrors the fixed controller:
 *   NS GREEN → NS YELLOW → ALL RED → EW GREEN → EW YELLOW → ALL RED → repeat
 */

import {
  Direction,
  DIRECTIONS,
  SignalState,
  Phase,
  PhaseState,
  VehicleType,
  Defaults,
} from '../simulation/constants.js';

export class AdaptiveController {
  /**
   * @param {import('../simulation/intersection.js').Intersection} intersection
   * @param {Object} [options]
   * @param {number} [options.minGreen] - Minimum green time per phase (seconds)
   * @param {number} [options.maxGreen] - Maximum green time per phase (seconds)
   * @param {number} [options.yellowTime] - Yellow duration (seconds)
   * @param {number} [options.allRedTime] - All-red clearance interval (seconds)
   * @param {number} [options.totalGreenBudget] - Total green time to distribute across both phases
   */
  constructor(intersection, options = {}) {
    this.intersection = intersection;
    this.minGreen = options.minGreen ?? Defaults.MIN_GREEN_TIME;
    this.maxGreen = options.maxGreen ?? Defaults.MAX_GREEN_TIME;
    this.yellowTime = options.yellowTime ?? Defaults.YELLOW_TIME;
    this.allRedTime = options.allRedTime ?? Defaults.ALL_RED_TIME;
    // Total green budget is the pool of time distributed between the two phases
    this.totalGreenBudget = options.totalGreenBudget ?? (Defaults.FIXED_GREEN_TIME * 2);

    // Phase state
    this.currentPhase = Phase.NS;
    this.phaseState = PhaseState.GREEN;
    this.timer = 0;
    this.cycleCount = 0;

    // Computed green times (recalculated each cycle)
    this.greenTimeNS = this.minGreen;
    this.greenTimeEW = this.minGreen;

    // Emergency state
    this._emergencyOverride = false;
    this._emergencyDirection = null;

    // Apply initial signal states
    this._applySignals();
  }

  /**
   * Get the green time for the current phase.
   * @returns {number}
   * @private
   */
  _currentGreenTime() {
    return this.currentPhase === Phase.NS ? this.greenTimeNS : this.greenTimeEW;
  }

  /**
   * Recalculate green times based on sensor data.
   * Called at the start of each new cycle.
   * @param {Object} sensorSnapshot - From SensorAggregator.snapshot()
   * @private
   */
  _recalculateGreenTimes(sensorSnapshot) {
    if (!sensorSnapshot) {
      this.greenTimeNS = this.minGreen;
      this.greenTimeEW = this.minGreen;
      return;
    }

    const demandNS = (sensorSnapshot.north?.queueLength ?? 0)
                   + (sensorSnapshot.south?.queueLength ?? 0);
    const demandEW = (sensorSnapshot.east?.queueLength ?? 0)
                   + (sensorSnapshot.west?.queueLength ?? 0);
    const totalDemand = demandNS + demandEW;

    if (totalDemand === 0) {
      // No demand: give minimum green to both phases
      this.greenTimeNS = this.minGreen;
      this.greenTimeEW = this.minGreen;
      return;
    }

    const proportionNS = demandNS / totalDemand;
    const proportionEW = demandEW / totalDemand;

    this.greenTimeNS = this._clampGreen(proportionNS * this.totalGreenBudget);
    this.greenTimeEW = this._clampGreen(proportionEW * this.totalGreenBudget);

    // Starvation bonus: if one phase has any waiting vehicles but
    // calculated green is at minimum, bump it slightly to ensure service
    if (demandNS > 0 && this.greenTimeNS === this.minGreen) {
      this.greenTimeNS = this.minGreen + 2;
    }
    if (demandEW > 0 && this.greenTimeEW === this.minGreen) {
      this.greenTimeEW = this.minGreen + 2;
    }
  }

  /**
   * Clamp green time to [minGreen, maxGreen].
   * @param {number} time
   * @returns {number}
   * @private
   */
  _clampGreen(time) {
    return Math.max(this.minGreen, Math.min(this.maxGreen, Math.round(time)));
  }

  /**
   * Check for emergency vehicles and override if needed.
   * @param {Object} sensorSnapshot
   * @returns {boolean} Whether an emergency override was activated
   * @private
   */
  _checkEmergency(sensorSnapshot) {
    if (!sensorSnapshot) return false;

    // Check each direction for emergency vehicles
    for (const dir of DIRECTIONS) {
      const lane = this.intersection.getInboundLane(dir);
      const hasEmergency = lane.vehicles.some(
        v => v.type === VehicleType.EMERGENCY && !v.isDeparted
      );

      if (hasEmergency) {
        const emergencyPhase = (dir === Direction.NORTH || dir === Direction.SOUTH)
          ? Phase.NS
          : Phase.EW;

        // If emergency vehicle is in a different phase, force switch
        if (this.currentPhase !== emergencyPhase || this.phaseState !== PhaseState.GREEN) {
          this._emergencyOverride = true;
          this._emergencyDirection = dir;

          // Force transition to the emergency phase
          this.currentPhase = emergencyPhase;
          this.phaseState = PhaseState.GREEN;
          this.timer = 0;

          // Give maximum green to clear the emergency vehicle
          if (emergencyPhase === Phase.NS) {
            this.greenTimeNS = this.maxGreen;
          } else {
            this.greenTimeEW = this.maxGreen;
          }

          this._applySignals();
          return true;
        }
      }
    }

    // Check if emergency has cleared
    if (this._emergencyOverride && this._emergencyDirection) {
      const lane = this.intersection.getInboundLane(this._emergencyDirection);
      const stillHasEmergency = lane.vehicles.some(
        v => v.type === VehicleType.EMERGENCY && !v.isDeparted
      );
      if (!stillHasEmergency) {
        this._emergencyOverride = false;
        this._emergencyDirection = null;
      }
    }

    return false;
  }

  /**
   * Update the controller for one simulation tick.
   * @param {number} dt - Tick interval in seconds
   * @param {Object} sensorSnapshot - From SensorAggregator.snapshot()
   */
  update(dt, sensorSnapshot) {
    // Check emergency override first
    if (this._checkEmergency(sensorSnapshot)) {
      return; // Emergency override took effect
    }

    this.timer += dt;

    switch (this.phaseState) {
      case PhaseState.GREEN:
        if (this.timer >= this._currentGreenTime()) {
          this.phaseState = PhaseState.YELLOW;
          this.timer = 0;
          this._applySignals();
        }
        break;

      case PhaseState.YELLOW:
        if (this.timer >= this.yellowTime) {
          this.phaseState = PhaseState.ALL_RED;
          this.timer = 0;
          this._applySignals();
        }
        break;

      case PhaseState.ALL_RED:
        if (this.timer >= this.allRedTime) {
          // Switch phase and recalculate green times
          this.currentPhase = this.currentPhase === Phase.NS ? Phase.EW : Phase.NS;
          this.phaseState = PhaseState.GREEN;
          this.timer = 0;

          if (this.currentPhase === Phase.NS) {
            this.cycleCount++;
          }

          // Recalculate green times at the start of each new green phase
          this._recalculateGreenTimes(sensorSnapshot);
          this._applySignals();
        }
        break;
    }
  }

  /**
   * Apply signal states based on current phase and phase state.
   * @private
   */
  _applySignals() {
    const signals = this.intersection.signals;

    if (this.phaseState === PhaseState.ALL_RED) {
      for (const dir of DIRECTIONS) {
        signals[dir].setState(SignalState.RED);
      }
      return;
    }

    if (this.currentPhase === Phase.NS) {
      const nsState = this.phaseState === PhaseState.GREEN ? SignalState.GREEN : SignalState.YELLOW;
      signals[Direction.NORTH].setState(nsState);
      signals[Direction.SOUTH].setState(nsState);
      signals[Direction.EAST].setState(SignalState.RED);
      signals[Direction.WEST].setState(SignalState.RED);
    } else {
      const ewState = this.phaseState === PhaseState.GREEN ? SignalState.GREEN : SignalState.YELLOW;
      signals[Direction.NORTH].setState(SignalState.RED);
      signals[Direction.SOUTH].setState(SignalState.RED);
      signals[Direction.EAST].setState(ewState);
      signals[Direction.WEST].setState(ewState);
    }
  }

  /**
   * Reset controller to initial state.
   */
  reset() {
    this.currentPhase = Phase.NS;
    this.phaseState = PhaseState.GREEN;
    this.timer = 0;
    this.cycleCount = 0;
    this.greenTimeNS = this.minGreen;
    this.greenTimeEW = this.minGreen;
    this._emergencyOverride = false;
    this._emergencyDirection = null;
    this._applySignals();
  }

  /**
   * Get the current green times.
   * @returns {{ phaseNS: number, phaseEW: number }}
   */
  getGreenTimes() {
    return {
      phaseNS: this.greenTimeNS,
      phaseEW: this.greenTimeEW,
    };
  }

  /**
   * Serialize controller state.
   * @returns {Object}
   */
  toJSON() {
    return {
      type: 'adaptive',
      currentPhase: this.currentPhase,
      phaseState: this.phaseState,
      timer: Math.round(this.timer * 100) / 100,
      greenTimeNS: this.greenTimeNS,
      greenTimeEW: this.greenTimeEW,
      cycleCount: this.cycleCount,
      emergencyOverride: this._emergencyOverride,
    };
  }
}
