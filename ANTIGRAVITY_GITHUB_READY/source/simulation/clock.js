/**
 * ANTIGRAVITY — Simulation Clock
 * 
 * Manages simulation time using a fixed timestep model.
 * Each tick advances simulation time by a constant interval (default 0.1s),
 * independent of wall-clock time. This ensures deterministic behavior.
 * 
 * The speedMultiplier controls how many ticks execute per real second
 * when driving the simulation from a real-time loop (visualization).
 */

export class SimulationClock {
  /**
   * @param {number} tickInterval - Simulation time per tick in seconds (default 0.1)
   * @param {number} speedMultiplier - Ticks per real second at 1x speed (default 10)
   */
  constructor(tickInterval = 0.1, speedMultiplier = 1) {
    this._tickInterval = tickInterval;
    this._speedMultiplier = speedMultiplier;
    this._currentTime = 0;
    this._tickCount = 0;
    this._paused = false;
  }

  /**
   * Advances simulation time by one tick.
   * Returns the new simulation time.
   * @returns {number} Current simulation time in seconds
   */
  tick() {
    if (this._paused) return this._currentTime;
    this._currentTime += this._tickInterval;
    this._tickCount += 1;
    return this._currentTime;
  }

  /**
   * Current simulation time in seconds.
   * @returns {number}
   */
  get currentTime() {
    return this._currentTime;
  }

  /**
   * Total number of ticks elapsed.
   * @returns {number}
   */
  get tickCount() {
    return this._tickCount;
  }

  /**
   * Duration of each tick in simulation seconds.
   * @returns {number}
   */
  get tickInterval() {
    return this._tickInterval;
  }

  /**
   * Speed multiplier for real-time visualization.
   * @returns {number}
   */
  get speedMultiplier() {
    return this._speedMultiplier;
  }

  /**
   * @param {number} value
   */
  set speedMultiplier(value) {
    this._speedMultiplier = Math.max(0.1, value);
  }

  /**
   * Whether the simulation is paused.
   * @returns {boolean}
   */
  get paused() {
    return this._paused;
  }

  /**
   * Pause the simulation clock.
   */
  pause() {
    this._paused = true;
  }

  /**
   * Resume the simulation clock.
   */
  resume() {
    this._paused = false;
  }

  /**
   * Toggle pause state.
   * @returns {boolean} New pause state
   */
  togglePause() {
    this._paused = !this._paused;
    return this._paused;
  }

  /**
   * Reset the clock to initial state.
   */
  reset() {
    this._currentTime = 0;
    this._tickCount = 0;
    this._paused = false;
  }

  /**
   * Returns the wall-clock interval between ticks in milliseconds,
   * accounting for speed multiplier.
   * Used by the visualization loop to schedule ticks.
   * @returns {number} Milliseconds between ticks
   */
  get realTickIntervalMs() {
    return (this._tickInterval * 1000) / this._speedMultiplier;
  }

  /**
   * Format current time as MM:SS for display.
   * @returns {string}
   */
  formatTime() {
    const totalSeconds = Math.floor(this._currentTime);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}
