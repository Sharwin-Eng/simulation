/**
 * ANTIGRAVITY — Traffic Signal Model
 * 
 * Represents a single traffic signal controlling one inbound approach.
 * The signal cycles through RED → GREEN → YELLOW → RED.
 * 
 * Signals do not manage their own timing; the traffic controller
 * is responsible for setting signal states. This separation keeps
 * the signal model simple and the control logic centralized.
 */

import { SignalState } from './constants.js';

export class TrafficSignal {
  /**
   * @param {Object} options
   * @param {string} options.direction - Cardinal direction this signal controls
   */
  constructor({ direction }) {
    this.id = `signal_${direction}`;
    this.direction = direction;
    this.state = SignalState.RED;
    this.timeInState = 0;          // Seconds in current state
    this._previousState = null;    // For detecting state changes
  }

  /**
   * Whether the signal allows vehicles to proceed.
   * @returns {boolean}
   */
  get isGreen() {
    return this.state === SignalState.GREEN;
  }

  /**
   * Whether the signal requires vehicles to stop.
   * @returns {boolean}
   */
  get isRed() {
    return this.state === SignalState.RED;
  }

  /**
   * Whether the signal is in the yellow (warning) state.
   * @returns {boolean}
   */
  get isYellow() {
    return this.state === SignalState.YELLOW;
  }

  /**
   * Set the signal to a new state.
   * Resets the timeInState counter when the state changes.
   * @param {string} newState - One of SignalState values
   */
  setState(newState) {
    if (newState !== this.state) {
      this._previousState = this.state;
      this.state = newState;
      this.timeInState = 0;
    }
  }

  /**
   * Advance the internal timer by one tick.
   * @param {number} dt - Tick interval in seconds
   */
  update(dt) {
    this.timeInState += dt;
  }

  /**
   * Whether the state has changed since the last check.
   * Useful for triggering visual updates.
   * @returns {boolean}
   */
  hasChanged() {
    const changed = this._previousState !== null && this._previousState !== this.state;
    // Don't clear _previousState here — it's cleared on next setState
    return changed;
  }

  /**
   * Reset signal to initial state.
   */
  reset() {
    this.state = SignalState.RED;
    this.timeInState = 0;
    this._previousState = null;
  }

  /**
   * Serialize for debugging/analytics.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      direction: this.direction,
      state: this.state,
      timeInState: Math.round(this.timeInState * 100) / 100,
    };
  }
}
