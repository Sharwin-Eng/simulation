/**
 * ANTIGRAVITY — Fixed-Timer Traffic Controller
 * 
 * Cycles between North-South and East-West phases
 * with constant green durations. Serves as the baseline
 * for comparing against the adaptive controller.
 * 
 * Phase sequence:
 *   NS GREEN → NS YELLOW → ALL RED → EW GREEN → EW YELLOW → ALL RED → repeat
 */

import {
  Direction,
  SignalState,
  Phase,
  PhaseState,
  Defaults,
} from '../simulation/constants.js';

export class FixedTimerController {
  /**
   * @param {import('../simulation/intersection.js').Intersection} intersection
   * @param {Object} [options]
   * @param {number} [options.greenTime] - Fixed green duration per phase (seconds)
   * @param {number} [options.yellowTime] - Yellow duration (seconds)
   * @param {number} [options.allRedTime] - All-red clearance interval (seconds)
   */
  constructor(intersection, options = {}) {
    this.intersection = intersection;
    this.greenTime = options.greenTime ?? Defaults.FIXED_GREEN_TIME;
    this.yellowTime = options.yellowTime ?? Defaults.YELLOW_TIME;
    this.allRedTime = options.allRedTime ?? Defaults.ALL_RED_TIME;

    // State
    this.currentPhase = Phase.NS;
    this.phaseState = PhaseState.GREEN;
    this.timer = 0;            // Time elapsed in current phase state
    this.cycleCount = 0;       // Number of complete cycles

    // Apply initial signal states
    this._applySignals();
  }

  /**
   * Update the controller for one simulation tick.
   * Manages phase transitions based on elapsed time.
   * @param {number} dt - Tick interval in seconds
   * @param {Object} [_sensorSnapshot] - Unused; signature matches adaptive controller
   */
  update(dt, _sensorSnapshot) {
    this.timer += dt;

    switch (this.phaseState) {
      case PhaseState.GREEN:
        if (this.timer >= this.greenTime) {
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
          // Switch to next phase
          this.currentPhase = this.currentPhase === Phase.NS ? Phase.EW : Phase.NS;
          this.phaseState = PhaseState.GREEN;
          this.timer = 0;
          if (this.currentPhase === Phase.NS) {
            this.cycleCount++;
          }
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
      // All red clearance
      for (const dir of [Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST]) {
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
    this._applySignals();
  }

  /**
   * Get the current green time for each phase.
   * Fixed controller always returns the same value.
   * @returns {{ phaseNS: number, phaseEW: number }}
   */
  getGreenTimes() {
    return {
      phaseNS: this.greenTime,
      phaseEW: this.greenTime,
    };
  }

  /**
   * Serialize controller state.
   * @returns {Object}
   */
  toJSON() {
    return {
      type: 'fixed',
      currentPhase: this.currentPhase,
      phaseState: this.phaseState,
      timer: Math.round(this.timer * 100) / 100,
      greenTime: this.greenTime,
      cycleCount: this.cycleCount,
    };
  }
}
