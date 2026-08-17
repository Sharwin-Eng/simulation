/**
 * ANTIGRAVITY — Simulation Unit Tests
 * 
 * Tests for core simulation components:
 * - SeededRandom (determinism, range)
 * - SimulationClock (tick advancement, pause/resume, formatting)
 * - Vehicle (creation, state transitions, movement)
 * - Lane (vehicle management, ordering)
 * - Road (structure)
 * - TrafficSignal (state management)
 * - Intersection (composition)
 * - VehicleSpawner (probabilistic spawning)
 * - SimulationEngine (full tick cycle)
 * 
 * Run: node --test tests/simulation.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { SeededRandom } from '../source/simulation/random.js';
import { SimulationClock } from '../source/simulation/clock.js';
import { Vehicle, resetVehicleIds } from '../source/simulation/vehicle.js';
import { Lane } from '../source/simulation/lane.js';
import { Road } from '../source/simulation/road.js';
import { TrafficSignal } from '../source/simulation/signal.js';
import { Intersection } from '../source/simulation/intersection.js';
import { VehicleSpawner } from '../source/simulation/spawner.js';
import { SimulationEngine } from '../source/simulation/engine.js';
import {
  Direction,
  DIRECTIONS,
  LaneType,
  SignalState,
  VehicleState,
  VehicleType,
  Defaults,
} from '../source/simulation/constants.js';

// ─── SeededRandom Tests ───────────────────────────────────

describe('SeededRandom', () => {
  it('produces deterministic sequences for the same seed', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      assert.equal(rng1.next(), rng2.next(), `Mismatch at iteration ${i}`);
    }
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(99);

    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (rng1.next() !== rng2.next()) {
        allSame = false;
        break;
      }
    }
    assert.equal(allSame, false, 'Different seeds should produce different sequences');
  });

  it('next() returns values in [0, 1)', () => {
    const rng = new SeededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      assert.ok(val >= 0 && val < 1, `Value ${val} out of range`);
    }
  });

  it('nextInt() returns values in [min, max]', () => {
    const rng = new SeededRandom(456);
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(5, 10);
      assert.ok(val >= 5 && val <= 10, `Value ${val} out of range [5, 10]`);
    }
  });

  it('nextFloat() returns values in [min, max)', () => {
    const rng = new SeededRandom(789);
    for (let i = 0; i < 100; i++) {
      const val = rng.nextFloat(2.0, 5.0);
      assert.ok(val >= 2.0 && val < 5.0, `Value ${val} out of range [2.0, 5.0)`);
    }
  });

  it('chance() returns boolean', () => {
    const rng = new SeededRandom(42);
    const result = rng.chance(0.5);
    assert.equal(typeof result, 'boolean');
  });

  it('reset() restores initial sequence', () => {
    const rng = new SeededRandom(42);
    const first = [];
    for (let i = 0; i < 10; i++) first.push(rng.next());

    rng.reset();
    for (let i = 0; i < 10; i++) {
      assert.equal(rng.next(), first[i], `Mismatch after reset at ${i}`);
    }
  });
});

// ─── SimulationClock Tests ────────────────────────────────

describe('SimulationClock', () => {
  it('starts at time 0', () => {
    const clock = new SimulationClock();
    assert.equal(clock.currentTime, 0);
    assert.equal(clock.tickCount, 0);
  });

  it('advances by tickInterval each tick', () => {
    const clock = new SimulationClock(0.1);
    clock.tick();
    assert.ok(Math.abs(clock.currentTime - 0.1) < 1e-10);
    assert.equal(clock.tickCount, 1);

    clock.tick();
    assert.ok(Math.abs(clock.currentTime - 0.2) < 1e-10);
    assert.equal(clock.tickCount, 2);
  });

  it('does not advance when paused', () => {
    const clock = new SimulationClock(0.1);
    clock.tick();
    clock.pause();
    clock.tick();
    assert.ok(Math.abs(clock.currentTime - 0.1) < 1e-10);
    assert.equal(clock.tickCount, 1);
  });

  it('resumes correctly after pause', () => {
    const clock = new SimulationClock(0.1);
    clock.tick();
    clock.pause();
    clock.tick();
    clock.resume();
    clock.tick();
    assert.ok(Math.abs(clock.currentTime - 0.2) < 1e-10);
    assert.equal(clock.tickCount, 2);
  });

  it('formats time as MM:SS', () => {
    const clock = new SimulationClock(1);
    for (let i = 0; i < 65; i++) clock.tick();
    assert.equal(clock.formatTime(), '01:05');
  });

  it('reset() restores initial state', () => {
    const clock = new SimulationClock(0.1);
    for (let i = 0; i < 100; i++) clock.tick();
    clock.reset();
    assert.equal(clock.currentTime, 0);
    assert.equal(clock.tickCount, 0);
    assert.equal(clock.paused, false);
  });

  it('calculates realTickIntervalMs based on speed multiplier', () => {
    const clock = new SimulationClock(0.1, 2);
    assert.equal(clock.realTickIntervalMs, 50); // 100ms / 2
  });
});

// ─── Vehicle Tests ────────────────────────────────────────

describe('Vehicle', () => {
  beforeEach(() => {
    resetVehicleIds();
  });

  it('creates a vehicle with sequential IDs', () => {
    const v1 = new Vehicle({ direction: Direction.NORTH });
    const v2 = new Vehicle({ direction: Direction.SOUTH });
    assert.equal(v1.id, 1);
    assert.equal(v2.id, 2);
  });

  it('starts in APPROACHING state', () => {
    const v = new Vehicle({ direction: Direction.NORTH });
    assert.equal(v.state, VehicleState.APPROACHING);
  });

  it('starts at position 0', () => {
    const v = new Vehicle({ direction: Direction.NORTH });
    assert.equal(v.position, 0);
  });

  it('identifies emergency vehicles', () => {
    const normal = new Vehicle({ direction: Direction.NORTH, type: VehicleType.NORMAL });
    const emergency = new Vehicle({ direction: Direction.NORTH, type: VehicleType.EMERGENCY });
    assert.equal(normal.isEmergency, false);
    assert.equal(emergency.isEmergency, true);
  });

  it('moves forward when signal is green and path is clear', () => {
    const v = new Vehicle({ direction: Direction.NORTH });
    v.update(0.1, {
      signalGreen: true,
      stopLinePosition: 300,
      vehicleAhead: null,
      minGap: 2.0,
      laneLength: 600,
      currentTime: 0.1,
    });
    assert.ok(v.position > 0, 'Vehicle should move forward');
  });

  it('stops at red signal', () => {
    const v = new Vehicle({ direction: Direction.NORTH, maxSpeed: 10 });
    v.position = 270; // Well before stop line to allow braking
    v.speed = 5;      // Moderate speed approaching

    // Run several ticks to let it stop
    for (let i = 0; i < 100; i++) {
      v.update(0.1, {
        signalGreen: false,
        stopLinePosition: 300,
        vehicleAhead: null,
        minGap: 2.0,
        laneLength: 600,
        currentTime: i * 0.1,
      });
    }
    assert.ok(v.position <= 300, `Vehicle should not pass stop line on red, pos=${v.position}`);
    assert.equal(v.state, VehicleState.QUEUED);
  });

  it('tracks wait time while queued', () => {
    const v = new Vehicle({ direction: Direction.NORTH, maxSpeed: 5 });
    v.position = 280;
    v.speed = 3;

    // Approach and queue at red signal for several ticks
    for (let t = 1; t <= 50; t++) {
      v.update(0.1, {
        signalGreen: false,
        stopLinePosition: 300,
        vehicleAhead: null,
        minGap: 2.0,
        laneLength: 600,
        currentTime: t * 0.1,
      });
    }
    v.finalizeWaitTime(5.0);
    assert.ok(v.totalWaitTime > 0, `Should accumulate wait time, got ${v.totalWaitTime}`);
  });

  it('serializes to JSON', () => {
    const v = new Vehicle({ direction: Direction.NORTH });
    const json = v.toJSON();
    assert.equal(json.direction, Direction.NORTH);
    assert.equal(json.state, VehicleState.APPROACHING);
    assert.equal(typeof json.position, 'number');
  });
});

// ─── Lane Tests ───────────────────────────────────────────

describe('Lane', () => {
  beforeEach(() => {
    resetVehicleIds();
  });

  it('starts empty', () => {
    const lane = new Lane({ id: 'test', direction: Direction.NORTH, type: LaneType.INBOUND });
    assert.equal(lane.vehicleCount, 0);
  });

  it('adds vehicles', () => {
    const lane = new Lane({ id: 'test', direction: Direction.NORTH, type: LaneType.INBOUND });
    const v = new Vehicle({ direction: Direction.NORTH });
    lane.addVehicle(v);
    assert.equal(lane.vehicleCount, 1);
  });

  it('sorts vehicles by position descending', () => {
    const lane = new Lane({ id: 'test', direction: Direction.NORTH, type: LaneType.INBOUND });
    const v1 = new Vehicle({ direction: Direction.NORTH });
    v1.position = 100;
    const v2 = new Vehicle({ direction: Direction.NORTH });
    v2.position = 200;
    const v3 = new Vehicle({ direction: Direction.NORTH });
    v3.position = 50;

    lane.addVehicle(v1);
    lane.addVehicle(v2);
    lane.addVehicle(v3);
    lane.sortVehicles();

    assert.equal(lane.vehicles[0].position, 200);
    assert.equal(lane.vehicles[1].position, 100);
    assert.equal(lane.vehicles[2].position, 50);
  });

  it('removes departed vehicles', () => {
    const lane = new Lane({ id: 'test', direction: Direction.NORTH, type: LaneType.INBOUND });
    const v1 = new Vehicle({ direction: Direction.NORTH });
    const v2 = new Vehicle({ direction: Direction.NORTH });
    v2.state = VehicleState.DEPARTED;

    lane.addVehicle(v1);
    lane.addVehicle(v2);
    const departed = lane.removeDeparted();

    assert.equal(departed.length, 1);
    assert.equal(lane.vehicleCount, 1);
  });

  it('detects spawn space', () => {
    const lane = new Lane({ id: 'test', direction: Direction.NORTH, type: LaneType.INBOUND, length: 300 });
    assert.equal(lane.hasSpawnSpace(), true);

    const v = new Vehicle({ direction: Direction.NORTH });
    v.position = 3; // Very near start
    lane.addVehicle(v);
    assert.equal(lane.hasSpawnSpace(), false);
  });

  it('gets vehicle ahead', () => {
    const lane = new Lane({ id: 'test', direction: Direction.NORTH, type: LaneType.INBOUND });
    const v1 = new Vehicle({ direction: Direction.NORTH });
    v1.position = 200;
    const v2 = new Vehicle({ direction: Direction.NORTH });
    v2.position = 100;

    lane.addVehicle(v1);
    lane.addVehicle(v2);
    lane.sortVehicles();

    assert.equal(lane.getVehicleAhead(v2), v1);
    assert.equal(lane.getVehicleAhead(v1), null);
  });
});

// ─── Road Tests ───────────────────────────────────────────

describe('Road', () => {
  it('creates inbound and outbound lanes', () => {
    const road = new Road({ direction: Direction.NORTH });
    assert.ok(road.inboundLane);
    assert.ok(road.outboundLane);
    assert.equal(road.inboundLane.type, LaneType.INBOUND);
    assert.equal(road.outboundLane.type, LaneType.OUTBOUND);
  });

  it('uses configured length', () => {
    const road = new Road({ direction: Direction.EAST, length: 500 });
    assert.equal(road.inboundLane.length, 500);
    assert.equal(road.outboundLane.length, 500);
  });
});

// ─── TrafficSignal Tests ──────────────────────────────────

describe('TrafficSignal', () => {
  it('starts RED', () => {
    const signal = new TrafficSignal({ direction: Direction.NORTH });
    assert.equal(signal.state, SignalState.RED);
    assert.equal(signal.isRed, true);
    assert.equal(signal.isGreen, false);
  });

  it('changes state', () => {
    const signal = new TrafficSignal({ direction: Direction.NORTH });
    signal.setState(SignalState.GREEN);
    assert.equal(signal.isGreen, true);
    assert.equal(signal.isRed, false);
    assert.equal(signal.timeInState, 0);
  });

  it('resets timeInState on state change', () => {
    const signal = new TrafficSignal({ direction: Direction.NORTH });
    signal.update(5.0);
    assert.equal(signal.timeInState, 5.0);

    signal.setState(SignalState.GREEN);
    assert.equal(signal.timeInState, 0);
  });

  it('tracks time in state', () => {
    const signal = new TrafficSignal({ direction: Direction.NORTH });
    signal.setState(SignalState.GREEN);
    signal.update(0.1);
    signal.update(0.1);
    assert.ok(Math.abs(signal.timeInState - 0.2) < 1e-10);
  });

  it('detects state changes', () => {
    const signal = new TrafficSignal({ direction: Direction.NORTH });
    assert.equal(signal.hasChanged(), false);

    signal.setState(SignalState.GREEN);
    assert.equal(signal.hasChanged(), true);
  });

  it('reset restores RED state', () => {
    const signal = new TrafficSignal({ direction: Direction.NORTH });
    signal.setState(SignalState.GREEN);
    signal.update(10);
    signal.reset();
    assert.equal(signal.state, SignalState.RED);
    assert.equal(signal.timeInState, 0);
  });
});

// ─── Intersection Tests ───────────────────────────────────

describe('Intersection', () => {
  it('creates four roads and four signals', () => {
    const ix = new Intersection();
    for (const dir of DIRECTIONS) {
      assert.ok(ix.getRoad(dir), `Missing road for ${dir}`);
      assert.ok(ix.getSignal(dir), `Missing signal for ${dir}`);
    }
  });

  it('all signals start RED', () => {
    const ix = new Intersection();
    for (const dir of DIRECTIONS) {
      assert.equal(ix.getSignal(dir).state, SignalState.RED);
    }
  });

  it('returns correct stop line position', () => {
    const ix = new Intersection({ roadLength: 250 });
    assert.equal(ix.getStopLinePosition(Direction.NORTH), 250);
  });

  it('returns all inbound lanes', () => {
    const ix = new Intersection();
    const lanes = ix.getAllInboundLanes();
    assert.equal(lanes.length, 4);
  });

  it('serializes to JSON', () => {
    const ix = new Intersection();
    const json = ix.toJSON();
    assert.equal(json.id, 'main');
    assert.ok(json.roads.north !== undefined);
    assert.ok(json.signals.north !== undefined);
  });

  it('reset clears all vehicles and signals', () => {
    const ix = new Intersection();
    ix.getSignal(Direction.NORTH).setState(SignalState.GREEN);
    ix.getInboundLane(Direction.NORTH).addVehicle(
      new Vehicle({ direction: Direction.NORTH })
    );

    ix.reset();
    assert.equal(ix.getSignal(Direction.NORTH).state, SignalState.RED);
    assert.equal(ix.getInboundLane(Direction.NORTH).vehicleCount, 0);
  });
});

// ─── VehicleSpawner Tests ─────────────────────────────────

describe('VehicleSpawner', () => {
  beforeEach(() => {
    resetVehicleIds();
  });

  it('spawns vehicles probabilistically', () => {
    const rng = new SeededRandom(42);
    const spawner = new VehicleSpawner({
      arrivalRates: { north: 60, south: 60, east: 60, west: 60 }, // 1 per second per direction
      random: rng,
    });
    const ix = new Intersection();

    let totalSpawned = 0;
    // Run 200 ticks (20 seconds) — expect roughly 20 per direction = 80 total
    // But spawn space checks limit actual count since vehicles don't move
    for (let i = 0; i < 200; i++) {
      const spawned = spawner.spawnTick(0.1, ix, totalSpawned);
      totalSpawned += spawned.length;
    }

    // Spawn space limits total since vehicles pile up at position 0.
    // Each direction can only hold a few vehicles near the entrance.
    assert.ok(totalSpawned > 0, `Expected some vehicles, got ${totalSpawned}`);
    assert.ok(totalSpawned < 200, `Too many vehicles: ${totalSpawned}`);
  });

  it('respects max vehicles limit', () => {
    const rng = new SeededRandom(42);
    const spawner = new VehicleSpawner({
      arrivalRates: { north: 600, south: 600, east: 600, west: 600 },
      random: rng,
    });
    const ix = new Intersection();

    let totalSpawned = 0;
    for (let i = 0; i < 1000; i++) {
      const spawned = spawner.spawnTick(0.1, ix, totalSpawned, 20);
      totalSpawned += spawned.length;
    }
    assert.ok(totalSpawned <= 20, `Exceeded max vehicles: ${totalSpawned}`);
  });

  it('tracks spawn counts', () => {
    const rng = new SeededRandom(42);
    const spawner = new VehicleSpawner({
      arrivalRates: { north: 60, south: 0, east: 0, west: 0 },
      random: rng,
    });
    const ix = new Intersection();

    for (let i = 0; i < 100; i++) {
      spawner.spawnTick(0.1, ix, 0);
    }

    assert.ok(spawner.spawnCounts.north > 0);
    assert.equal(spawner.spawnCounts.south, 0);
    assert.equal(spawner.spawnCounts.east, 0);
    assert.equal(spawner.spawnCounts.west, 0);
  });
});

// ─── SimulationEngine Tests ───────────────────────────────

describe('SimulationEngine', () => {
  beforeEach(() => {
    resetVehicleIds();
  });

  it('creates with default config', () => {
    const engine = new SimulationEngine();
    assert.equal(engine.currentTime, 0);
    assert.equal(engine.activeVehicles.length, 0);
    assert.equal(engine.running, false);
  });

  it('advances time on tick', () => {
    const engine = new SimulationEngine();
    engine.tick();
    assert.ok(engine.currentTime > 0);
  });

  it('produces deterministic results', () => {
    const config = {
      simulation: { randomSeed: 42, tickInterval: 0.1 },
      arrival: { north: 30, south: 30, east: 30, west: 30 },
    };

    const engine1 = new SimulationEngine(config);
    const engine2 = new SimulationEngine(config);

    // Run 100 ticks
    for (let i = 0; i < 100; i++) {
      engine1.tick();
      engine2.tick();
    }

    assert.equal(engine1.activeVehicles.length, engine2.activeVehicles.length);
    assert.equal(engine1.departedVehicles.length, engine2.departedVehicles.length);
  });

  it('spawns and tracks vehicles', () => {
    const config = {
      simulation: { randomSeed: 42 },
      arrival: { north: 120, south: 120, east: 120, west: 120 }, // High rate
    };

    const engine = new SimulationEngine(config);

    // Set some signals to green so vehicles can depart
    engine.intersection.getSignal(Direction.NORTH).setState(SignalState.GREEN);
    engine.intersection.getSignal(Direction.SOUTH).setState(SignalState.GREEN);

    for (let i = 0; i < 500; i++) {
      engine.tick();
    }

    assert.ok(engine.activeVehicles.length > 0 || engine.departedVehicles.length > 0,
      'Should have some vehicles after 500 ticks');
  });

  it('notifies tick listeners', () => {
    const engine = new SimulationEngine();
    let callCount = 0;
    let lastResult = null;

    engine.onTick((result) => {
      callCount++;
      lastResult = result;
    });

    engine.tick();
    assert.equal(callCount, 1);
    assert.ok(lastResult !== null);
    assert.equal(typeof lastResult.time, 'number');
    assert.equal(typeof lastResult.activeVehicles, 'number');
  });

  it('resets to initial state', () => {
    const engine = new SimulationEngine({
      arrival: { north: 120, south: 120, east: 120, west: 120 },
    });

    for (let i = 0; i < 100; i++) engine.tick();
    engine.reset();

    assert.equal(engine.currentTime, 0);
    assert.equal(engine.activeVehicles.length, 0);
    assert.equal(engine.departedVehicles.length, 0);
    assert.equal(engine.running, false);
  });

  it('serializes to JSON', () => {
    const engine = new SimulationEngine();
    engine.tick();
    const json = engine.toJSON();
    assert.equal(typeof json.time, 'number');
    assert.ok(json.intersection !== undefined);
  });

  it('accepts custom config', () => {
    const engine = new SimulationEngine({
      simulation: { tickInterval: 0.05, randomSeed: 99 },
      road: { length: 200 },
      vehicle: { maxSpeed: 10 },
    });

    assert.equal(engine.clock.tickInterval, 0.05);
    assert.equal(engine.random.seed, 99);
    assert.equal(engine.intersection.getStopLinePosition(Direction.NORTH), 200);
  });
});
