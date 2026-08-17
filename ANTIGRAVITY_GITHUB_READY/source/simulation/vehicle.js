/**
 * ANTIGRAVITY — Vehicle Entity
 * 
 * Represents a single vehicle in the simulation.
 * Vehicles have position, speed, and state. They move along lanes,
 * queue at red signals, and depart through the intersection.
 * 
 * Movement model: simplified car-following.
 * - Vehicles accelerate toward maxSpeed when the path is clear.
 * - Vehicles decelerate when approaching a red signal or a vehicle ahead.
 * - No lane changing (single lane per direction).
 */

import { VehicleState, VehicleType, Defaults } from './constants.js';

let vehicleIdCounter = 0;

/**
 * Reset the global vehicle ID counter.
 * Call this when resetting the simulation.
 */
export function resetVehicleIds() {
  vehicleIdCounter = 0;
}

export class Vehicle {
  /**
   * @param {Object} options
   * @param {string} options.type - VehicleType.NORMAL or VehicleType.EMERGENCY
   * @param {string} options.direction - Direction of travel
   * @param {number} [options.maxSpeed] - Maximum speed in m/s
   * @param {number} [options.acceleration] - Acceleration in m/s²
   * @param {number} [options.deceleration] - Deceleration in m/s²
   * @param {number} [options.length] - Vehicle length in meters
   */
  constructor({
    type = VehicleType.NORMAL,
    direction,
    maxSpeed = Defaults.VEHICLE_MAX_SPEED,
    acceleration = Defaults.VEHICLE_ACCELERATION,
    deceleration = Defaults.VEHICLE_DECELERATION,
    length = Defaults.VEHICLE_LENGTH,
  }) {
    this.id = ++vehicleIdCounter;
    this.type = type;
    this.direction = direction;

    // Kinematics
    this.position = 0;             // Distance from lane start (meters)
    this.speed = maxSpeed;         // Start at cruising speed
    this.maxSpeed = maxSpeed;
    this.acceleration = acceleration;
    this.deceleration = deceleration;
    this.length = length;

    // State
    this.state = VehicleState.APPROACHING;
    this.waitStartTime = -1;       // When this vehicle started waiting
    this.totalWaitTime = 0;        // Accumulated wait time in seconds
  }

  /**
   * Whether this vehicle is an emergency vehicle.
   * @returns {boolean}
   */
  get isEmergency() {
    return this.type === VehicleType.EMERGENCY;
  }

  /**
   * Whether this vehicle has departed the simulation.
   * @returns {boolean}
   */
  get isDeparted() {
    return this.state === VehicleState.DEPARTED;
  }

  /**
   * Whether this vehicle is currently waiting (queued).
   * @returns {boolean}
   */
  get isWaiting() {
    return this.state === VehicleState.QUEUED;
  }

  /**
   * Update vehicle position and state for one simulation tick.
   * 
   * @param {number} dt - Tick interval in seconds
   * @param {Object} context
   * @param {boolean} context.signalGreen - Whether the signal for this vehicle's direction is green
   * @param {number} context.stopLinePosition - Position of the stop line on the lane
   * @param {Vehicle|null} context.vehicleAhead - The vehicle immediately ahead, or null
   * @param {number} context.minGap - Minimum gap between vehicles in meters
   * @param {number} context.laneLength - Total lane length in meters
   * @param {number} context.currentTime - Current simulation time for wait tracking
   */
  update(dt, context) {
    const {
      signalGreen,
      stopLinePosition,
      vehicleAhead,
      minGap = Defaults.VEHICLE_MIN_GAP,
      laneLength,
      currentTime,
    } = context;

    if (this.state === VehicleState.DEPARTED) return;

    // Calculate the effective stopping point
    let stopPoint = Infinity;

    // Stop for red/yellow signal at the stop line (only if not already past it)
    if (!signalGreen && this.position <= stopLinePosition) {
      stopPoint = Math.min(stopPoint, stopLinePosition);
    }

    // Stop behind the vehicle ahead (maintain minimum gap)
    if (vehicleAhead && vehicleAhead.state !== VehicleState.DEPARTED) {
      const behindPoint = vehicleAhead.position - vehicleAhead.length - minGap;
      stopPoint = Math.min(stopPoint, behindPoint);
    }

    // Determine desired speed
    const distanceToStop = stopPoint - this.position;

    if (distanceToStop <= 0 && stopPoint !== Infinity) {
      // Already at or past the stop point — hold position
      this.speed = 0;
      this.position = Math.min(this.position, stopPoint);
      this._enterQueuedState(currentTime);
    } else if (stopPoint !== Infinity) {
      // Calculate the maximum safe speed to stop within the remaining distance.
      // From v² = 2 * a * d → v_safe = sqrt(2 * deceleration * distanceToStop)
      const safeSpeed = Math.sqrt(2 * this.deceleration * distanceToStop);
      // Also cap speed so we can't overshoot the stop point in a single tick
      const maxTickSpeed = distanceToStop / dt;

      if (this.speed > safeSpeed) {
        // Need to brake: reduce speed toward the safe stopping speed
        this.speed = Math.max(0, this.speed - this.deceleration * dt);
        // Also clamp to safe speed to prevent overshoot on the first brake tick
        this.speed = Math.min(this.speed, safeSpeed, maxTickSpeed);
        if (this.speed <= 0.01) {
          this.speed = 0;
          this._enterQueuedState(currentTime);
        }
      } else {
        // Safe distance: accelerate toward max speed
        this._accelerate(dt);
        // But never exceed the safe stopping speed for the remaining distance
        this.speed = Math.min(this.speed, safeSpeed, maxTickSpeed);
        this._exitQueuedState(currentTime);
      }
    } else {
      // No obstruction: accelerate toward max speed
      this._accelerate(dt);
      this._exitQueuedState(currentTime);
    }

    // Update position
    this.position += this.speed * dt;

    // Hard clamp: never overshoot the stop point
    if (stopPoint !== Infinity && this.position >= stopPoint) {
      this.position = stopPoint;
      this.speed = 0;
      this._enterQueuedState(currentTime);
    }

    // Update crossing state — only transition to CROSSING when signal is green
    // and vehicle is at or past stop line
    if (this.position >= stopLinePosition && signalGreen) {
      if (this.state === VehicleState.QUEUED || this.state === VehicleState.APPROACHING) {
        this.state = VehicleState.CROSSING;
        this._exitQueuedState(currentTime);
      }
    }

    // Check departure (past end of outbound lane)
    if (this.state === VehicleState.CROSSING && this.position >= laneLength) {
      this.state = VehicleState.DEPARTED;
    }
  }

  /**
   * Transition to QUEUED state if not already queued.
   * @param {number} currentTime
   * @private
   */
  _enterQueuedState(currentTime) {
    if (this.state !== VehicleState.QUEUED) {
      this.state = VehicleState.QUEUED;
      if (this.waitStartTime < 0) {
        this.waitStartTime = currentTime;
      }
    }
  }

  /**
   * Exit QUEUED state and accumulate wait time.
   * @param {number} currentTime
   * @private
   */
  _exitQueuedState(currentTime) {
    if (this.state === VehicleState.QUEUED) {
      this.state = VehicleState.APPROACHING;
    }
    if (this.waitStartTime >= 0) {
      this.totalWaitTime += currentTime - this.waitStartTime;
      this.waitStartTime = -1;
    }
  }

  /**
   * Accelerate toward maximum speed.
   * @param {number} dt - Time step in seconds
   * @private
   */
  _accelerate(dt) {
    if (this.speed < this.maxSpeed) {
      this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * dt);
    }
  }

  /**
   * Finalize wait time when vehicle departs or simulation ends.
   * @param {number} currentTime
   */
  finalizeWaitTime(currentTime) {
    if (this.waitStartTime >= 0) {
      this.totalWaitTime += currentTime - this.waitStartTime;
      this.waitStartTime = -1;
    }
  }

  /**
   * Serialize vehicle state for debugging/analytics.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      direction: this.direction,
      position: Math.round(this.position * 100) / 100,
      speed: Math.round(this.speed * 100) / 100,
      state: this.state,
      totalWaitTime: Math.round(this.totalWaitTime * 100) / 100,
    };
  }
}
