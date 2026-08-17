/**
 * ANTIGRAVITY — Sensor & Controller Tests
 * 
 * Tests for:
 * - QueueLengthSensor
 * - ArrivalRateSensor
 * - WaitingTimeSensor
 * - SensorAggregator
 * - FixedTimerController
 * - AdaptiveController
 * 
 * Run: node --test tests/sensors-control.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Vehicle, resetVehicleIds } from '../source/simulation/vehicle.js';
import { Intersection } from '../source/simulation/intersection.js';
import { VehicleSpawner } from '../source/simulation/spawner.js';
import { SeededRandom } from '../source/simulation/random.js';
import {
  Direction,
  DIRECTIONS,
  SignalState,
  VehicleState,
  VehicleType,
  Phase,
  PhaseState,
  Defaults,
} from '../source/simulation/constants.js';

import { QueueLengthSensor } from '../source/simulation/sensors/queue-sensor.js';
import { ArrivalRateSensor } from '../source/simulation/sensors/arrival-sensor.js';
import { WaitingTimeSensor } from '../source/simulation/sensors/wait-sensor.js';
import { SensorAggregator } from '../source/simulation/sensors/aggregator.js';

import { FixedTimerController } from '../source/control/fixed-controller.js';
import { AdaptiveController } from '../source/control/adaptive-controller.js';

// ─── QueueLengthSensor Tests ──────────────────────────────

describe('QueueLengthSensor', () => {
  beforeEach(() => resetVehicleIds());

  it('returns 0 for empty lane', () => {
    const ix = new Intersection();
    const sensor = new QueueLengthSensor({
      direction: Direction.NORTH,
      lane: ix.getInboundLane(Direction.NORTH),
    });
    const reading = sensor.read(0);
    assert.equal(reading.queueLength, 0);
  });

  it('counts queued vehicles', () => {
    const ix = new Intersection();
    const lane = ix.getInboundLane(Direction.NORTH);

    // Add 3 queued vehicles
    for (let i = 0; i < 3; i++) {
      const v = new Vehicle({ direction: Direction.NORTH });
      v.state = VehicleState.QUEUED;
      v.position = 280 + i * 10;
      lane.addVehicle(v);
    }

    // Add 1 approaching vehicle
    const approaching = new Vehicle({ direction: Direction.NORTH });
    approaching.state = VehicleState.APPROACHING;
    approaching.position = 100;
    lane.addVehicle(approaching);

    const sensor = new QueueLengthSensor({
      direction: Direction.NORTH,
      lane,
    });
    const reading = sensor.read(10);
    assert.equal(reading.queueLength, 3);
    assert.equal(reading.direction, Direction.NORTH);
  });
});

// ─── ArrivalRateSensor Tests ──────────────────────────────

describe('ArrivalRateSensor', () => {
  it('returns 0 with no arrivals', () => {
    const ix = new Intersection();
    const sensor = new ArrivalRateSensor({
      direction: Direction.NORTH,
      lane: ix.getInboundLane(Direction.NORTH),
      windowSize: 30,
    });
    sensor.update(1.0, 0);
    const reading = sensor.read(1.0);
    assert.equal(reading.arrivalRate, 0);
  });

  it('calculates arrival rate correctly', () => {
    const ix = new Intersection();
    const sensor = new ArrivalRateSensor({
      direction: Direction.NORTH,
      lane: ix.getInboundLane(Direction.NORTH),
      windowSize: 30,
    });

    // Simulate 10 arrivals over 10 seconds
    for (let t = 1; t <= 10; t++) {
      sensor.update(t, t); // 1 new arrival per second
    }

    const reading = sensor.read(10);
    // 10 arrivals in 10 seconds = 60 per minute
    assert.equal(reading.arrivalRate, 60);
  });

  it('resets correctly', () => {
    const ix = new Intersection();
    const sensor = new ArrivalRateSensor({
      direction: Direction.NORTH,
      lane: ix.getInboundLane(Direction.NORTH),
    });
    sensor.update(1.0, 5);
    sensor.reset();
    const reading = sensor.read(1.0);
    assert.equal(reading.arrivalRate, 0);
  });
});

// ─── WaitingTimeSensor Tests ──────────────────────────────

describe('WaitingTimeSensor', () => {
  beforeEach(() => resetVehicleIds());

  it('returns 0 for empty lane', () => {
    const ix = new Intersection();
    const sensor = new WaitingTimeSensor({
      direction: Direction.NORTH,
      lane: ix.getInboundLane(Direction.NORTH),
    });
    const reading = sensor.read(10);
    assert.equal(reading.avgWaitTime, 0);
    assert.equal(reading.maxWaitTime, 0);
  });

  it('measures wait time of queued vehicles', () => {
    const ix = new Intersection();
    const lane = ix.getInboundLane(Direction.NORTH);

    const v = new Vehicle({ direction: Direction.NORTH });
    v.state = VehicleState.QUEUED;
    v.waitStartTime = 5.0;
    v.position = 300;
    lane.addVehicle(v);

    const sensor = new WaitingTimeSensor({
      direction: Direction.NORTH,
      lane,
    });
    const reading = sensor.read(15.0);

    // Wait time = 15 - 5 = 10 seconds
    assert.equal(reading.avgWaitTime, 10);
    assert.equal(reading.maxWaitTime, 10);
  });
});

// ─── SensorAggregator Tests ──────────────────────────────

describe('SensorAggregator', () => {
  beforeEach(() => resetVehicleIds());

  it('returns snapshot for all directions', () => {
    const ix = new Intersection();
    const rng = new SeededRandom(42);
    const spawner = new VehicleSpawner({
      arrivalRates: { north: 20, south: 20, east: 20, west: 20 },
      random: rng,
    });

    const aggregator = new SensorAggregator(ix, spawner);
    aggregator.update(1.0);
    const snap = aggregator.snapshot(1.0);

    for (const dir of DIRECTIONS) {
      assert.ok(snap[dir] !== undefined, `Missing ${dir} in snapshot`);
      assert.equal(typeof snap[dir].queueLength, 'number');
      assert.equal(typeof snap[dir].arrivalRate, 'number');
      assert.equal(typeof snap[dir].avgWaitTime, 'number');
      assert.equal(typeof snap[dir].maxWaitTime, 'number');
    }
  });
});

// ─── FixedTimerController Tests ───────────────────────────

describe('FixedTimerController', () => {
  it('starts with NS green', () => {
    const ix = new Intersection();
    const ctrl = new FixedTimerController(ix, { greenTime: 10, yellowTime: 3, allRedTime: 2 });

    assert.equal(ix.getSignal(Direction.NORTH).state, SignalState.GREEN);
    assert.equal(ix.getSignal(Direction.SOUTH).state, SignalState.GREEN);
    assert.equal(ix.getSignal(Direction.EAST).state, SignalState.RED);
    assert.equal(ix.getSignal(Direction.WEST).state, SignalState.RED);
  });

  it('transitions through green → yellow → all-red → phase switch', () => {
    const ix = new Intersection();
    const ctrl = new FixedTimerController(ix, { greenTime: 10, yellowTime: 3, allRedTime: 2 });

    // Start: NS GREEN
    assert.equal(ctrl.phaseState, PhaseState.GREEN);
    assert.equal(ctrl.currentPhase, Phase.NS);

    // Run 101 ticks (10.1 seconds) — well past 10s green
    for (let i = 0; i < 101; i++) ctrl.update(0.1);
    assert.equal(ctrl.phaseState, PhaseState.YELLOW, 'Should be YELLOW after 10.1s');
    assert.equal(ix.getSignal(Direction.NORTH).state, SignalState.YELLOW);

    // Run 31 more ticks (3.1 seconds yellow)
    for (let i = 0; i < 31; i++) ctrl.update(0.1);
    assert.equal(ctrl.phaseState, PhaseState.ALL_RED, 'Should be ALL_RED after yellow');
    for (const dir of DIRECTIONS) {
      assert.equal(ix.getSignal(dir).state, SignalState.RED);
    }

    // Run 21 more ticks (2.1 seconds all-red)
    for (let i = 0; i < 21; i++) ctrl.update(0.1);
    assert.equal(ctrl.currentPhase, Phase.EW, 'Should switch to EW phase');
    assert.equal(ctrl.phaseState, PhaseState.GREEN);
    assert.equal(ix.getSignal(Direction.EAST).state, SignalState.GREEN);
    assert.equal(ix.getSignal(Direction.NORTH).state, SignalState.RED);
  });

  it('completes full cycle and counts', () => {
    const ix = new Intersection();
    const ctrl = new FixedTimerController(ix, { greenTime: 10, yellowTime: 3, allRedTime: 2 });

    // Full cycle = 2 * (10 + 3 + 2) = 30 seconds
    // Use 310 ticks to handle float accumulation across all 6 phase transitions
    for (let i = 0; i < 310; i++) ctrl.update(0.1);

    assert.equal(ctrl.cycleCount, 1);
    assert.equal(ctrl.currentPhase, Phase.NS);
  });

  it('returns constant green times', () => {
    const ix = new Intersection();
    const ctrl = new FixedTimerController(ix, { greenTime: 25 });
    const times = ctrl.getGreenTimes();
    assert.equal(times.phaseNS, 25);
    assert.equal(times.phaseEW, 25);
  });

  it('resets correctly', () => {
    const ix = new Intersection();
    const ctrl = new FixedTimerController(ix, { greenTime: 10 });

    for (let i = 0; i < 200; i++) ctrl.update(0.1);
    ctrl.reset();

    assert.equal(ctrl.currentPhase, Phase.NS);
    assert.equal(ctrl.phaseState, PhaseState.GREEN);
    assert.equal(ctrl.timer, 0);
    assert.equal(ctrl.cycleCount, 0);
  });
});

// ─── AdaptiveController Tests ─────────────────────────────

describe('AdaptiveController', () => {
  beforeEach(() => resetVehicleIds());

  it('starts with NS green', () => {
    const ix = new Intersection();
    const ctrl = new AdaptiveController(ix, { minGreen: 10, maxGreen: 60 });

    assert.equal(ix.getSignal(Direction.NORTH).state, SignalState.GREEN);
    assert.equal(ix.getSignal(Direction.SOUTH).state, SignalState.GREEN);
  });

  it('adjusts green time based on demand', () => {
    const ix = new Intersection();
    const ctrl = new AdaptiveController(ix, {
      minGreen: 5,
      maxGreen: 50,
      yellowTime: 3,
      allRedTime: 2,
      totalGreenBudget: 60,
    });

    // Add heavy queue to east direction
    const lane = ix.getInboundLane(Direction.EAST);
    for (let i = 0; i < 20; i++) {
      const v = new Vehicle({ direction: Direction.EAST });
      v.state = VehicleState.QUEUED;
      v.position = 250 + i * 2;
      lane.addVehicle(v);
    }

    // Create sensor snapshot with heavy EW demand
    const snapshot = {
      timestamp: 10,
      north: { queueLength: 2, arrivalRate: 10, avgWaitTime: 5, maxWaitTime: 8 },
      south: { queueLength: 1, arrivalRate: 8, avgWaitTime: 4, maxWaitTime: 6 },
      east: { queueLength: 20, arrivalRate: 40, avgWaitTime: 15, maxWaitTime: 30 },
      west: { queueLength: 15, arrivalRate: 35, avgWaitTime: 12, maxWaitTime: 25 },
    };

    // Run through NS phase: minGreen(5) + yellow(3) + allRed(2) = 10s = 101 ticks with margin
    for (let i = 0; i < 110; i++) ctrl.update(0.1, snapshot);

    // Now in EW phase — green times should have been recalculated
    assert.equal(ctrl.currentPhase, Phase.EW, 'Should be in EW phase');
    const times = ctrl.getGreenTimes();
    assert.ok(times.phaseEW > times.phaseNS,
      `EW(${times.phaseEW}) should be > NS(${times.phaseNS}) with heavy EW demand`);
  });

  it('enforces minimum green time (starvation prevention)', () => {
    const ix = new Intersection();
    const ctrl = new AdaptiveController(ix, {
      minGreen: 10,
      maxGreen: 60,
    });

    // Only north has demand — south/east/west have zero
    const snapshot = {
      timestamp: 5,
      north: { queueLength: 50, arrivalRate: 60, avgWaitTime: 20, maxWaitTime: 40 },
      south: { queueLength: 0, arrivalRate: 0, avgWaitTime: 0, maxWaitTime: 0 },
      east: { queueLength: 0, arrivalRate: 0, avgWaitTime: 0, maxWaitTime: 0 },
      west: { queueLength: 0, arrivalRate: 0, avgWaitTime: 0, maxWaitTime: 0 },
    };

    // Exhaust initial NS phase and transition to EW
    for (let i = 0; i < 200; i++) ctrl.update(0.1, snapshot);

    // EW should still get at least minGreen
    const times = ctrl.getGreenTimes();
    assert.ok(times.phaseEW >= 10,
      `EW green(${times.phaseEW}) should be >= minGreen(10)`);
  });

  it('handles emergency vehicle priority', () => {
    const ix = new Intersection();
    const ctrl = new AdaptiveController(ix, {
      minGreen: 10,
      maxGreen: 60,
      yellowTime: 3,
      allRedTime: 2,
    });

    // Controller starts in NS phase
    assert.equal(ctrl.currentPhase, Phase.NS);

    // Add emergency vehicle to east (EW phase)
    const lane = ix.getInboundLane(Direction.EAST);
    const emergency = new Vehicle({
      direction: Direction.EAST,
      type: VehicleType.EMERGENCY,
    });
    emergency.state = VehicleState.QUEUED;
    emergency.position = 290;
    lane.addVehicle(emergency);

    const snapshot = {
      timestamp: 2,
      north: { queueLength: 5, arrivalRate: 20, avgWaitTime: 5, maxWaitTime: 10 },
      south: { queueLength: 3, arrivalRate: 15, avgWaitTime: 3, maxWaitTime: 6 },
      east: { queueLength: 1, arrivalRate: 5, avgWaitTime: 1, maxWaitTime: 1 },
      west: { queueLength: 0, arrivalRate: 0, avgWaitTime: 0, maxWaitTime: 0 },
    };

    // Trigger update — should detect emergency and switch phase
    ctrl.update(0.1, snapshot);

    // Should have switched to EW phase for emergency
    assert.equal(ctrl.currentPhase, Phase.EW);
    assert.equal(ix.getSignal(Direction.EAST).state, SignalState.GREEN);
  });

  it('resets correctly', () => {
    const ix = new Intersection();
    const ctrl = new AdaptiveController(ix);

    for (let i = 0; i < 200; i++) ctrl.update(0.1, null);
    ctrl.reset();

    assert.equal(ctrl.currentPhase, Phase.NS);
    assert.equal(ctrl.phaseState, PhaseState.GREEN);
    assert.equal(ctrl.timer, 0);
    assert.equal(ctrl.cycleCount, 0);
    assert.equal(ctrl._emergencyOverride, false);
  });

  it('serializes to JSON', () => {
    const ix = new Intersection();
    const ctrl = new AdaptiveController(ix);
    const json = ctrl.toJSON();

    assert.equal(json.type, 'adaptive');
    assert.equal(typeof json.greenTimeNS, 'number');
    assert.equal(typeof json.greenTimeEW, 'number');
  });
});
