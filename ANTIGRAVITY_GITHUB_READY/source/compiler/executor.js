/**
 * ANTIGRAVITY — IR Executor
 * 
 * Interprets optimized IR instructions to configure and control
 * the simulation. Executes instruction-by-instruction with a
 * register file and variable store.
 * 
 * The executor bridges the compiler and the simulation:
 * - SET_CONFIG modifies simulation parameters
 * - SET_SIGNAL changes traffic signal states
 * - SPAWN_VEHICLE configures vehicle arrival rates
 * - READ_QUEUE/WAIT/EMERGENCY queries sensor data
 * - PRINT outputs to the console/dashboard
 */

import { IROpCode } from './ir-generator.js';

export class Executor {
  /**
   * @param {Object} [context] - Simulation context for runtime operations
   * @param {Object} [context.engine] - SimulationEngine reference
   * @param {Object} [context.sensors] - SensorAggregator reference
   * @param {Object} [context.controller] - Controller reference
   */
  constructor(context = {}) {
    this.engine = context.engine ?? null;
    this.sensors = context.sensors ?? null;
    this.controller = context.controller ?? null;

    // Execution state
    this.registers = new Map();
    this.variables = new Map();
    this.output = [];           // Captured print output
    this.configUpdates = [];    // Captured config changes
    this.signalUpdates = [];    // Captured signal changes
    this.spawnUpdates = [];     // Captured spawn commands
    this.extendUpdates = [];    // Captured extend commands
  }

  /**
   * Execute an IR instruction list.
   * @param {import('./ir-generator.js').IRInstruction[]} instructions
   * @returns {ExecutionResult}
   */
  execute(instructions) {
    // Build label → index map for jumps
    const labelIndex = new Map();
    for (let i = 0; i < instructions.length; i++) {
      if (instructions[i].op === IROpCode.LABEL) {
        labelIndex.set(instructions[i].args[0], i);
      }
    }

    let ip = 0; // Instruction pointer
    let stepCount = 0;
    const MAX_STEPS = 100000; // Safety limit to prevent infinite loops

    while (ip < instructions.length && stepCount < MAX_STEPS) {
      const instr = instructions[ip];
      stepCount++;

      switch (instr.op) {
        case IROpCode.LOAD_CONST:
          this.registers.set(instr.result, instr.args[0]);
          break;

        case IROpCode.LOAD_VAR:
          this.registers.set(instr.result, this.variables.get(instr.args[0]) ?? 0);
          break;

        case IROpCode.STORE_VAR:
          this.variables.set(instr.args[0], this._reg(instr.args[1]));
          break;

        case IROpCode.ADD:
          this.registers.set(instr.result, this._reg(instr.args[0]) + this._reg(instr.args[1]));
          break;
        case IROpCode.SUB:
          this.registers.set(instr.result, this._reg(instr.args[0]) - this._reg(instr.args[1]));
          break;
        case IROpCode.MUL:
          this.registers.set(instr.result, this._reg(instr.args[0]) * this._reg(instr.args[1]));
          break;
        case IROpCode.DIV: {
          const divisor = this._reg(instr.args[1]);
          this.registers.set(instr.result, divisor !== 0 ? this._reg(instr.args[0]) / divisor : 0);
          break;
        }

        case IROpCode.CMP_EQ:
          this.registers.set(instr.result, this._reg(instr.args[0]) === this._reg(instr.args[1]));
          break;
        case IROpCode.CMP_NEQ:
          this.registers.set(instr.result, this._reg(instr.args[0]) !== this._reg(instr.args[1]));
          break;
        case IROpCode.CMP_GT:
          this.registers.set(instr.result, this._reg(instr.args[0]) > this._reg(instr.args[1]));
          break;
        case IROpCode.CMP_LT:
          this.registers.set(instr.result, this._reg(instr.args[0]) < this._reg(instr.args[1]));
          break;
        case IROpCode.CMP_GTE:
          this.registers.set(instr.result, this._reg(instr.args[0]) >= this._reg(instr.args[1]));
          break;
        case IROpCode.CMP_LTE:
          this.registers.set(instr.result, this._reg(instr.args[0]) <= this._reg(instr.args[1]));
          break;

        case IROpCode.AND:
          this.registers.set(instr.result, this._reg(instr.args[0]) && this._reg(instr.args[1]));
          break;
        case IROpCode.OR:
          this.registers.set(instr.result, this._reg(instr.args[0]) || this._reg(instr.args[1]));
          break;
        case IROpCode.NOT:
          this.registers.set(instr.result, !this._reg(instr.args[0]));
          break;
        case IROpCode.NEGATE:
          this.registers.set(instr.result, -this._reg(instr.args[0]));
          break;

        case IROpCode.JUMP: {
          const target = labelIndex.get(instr.args[0]);
          if (target !== undefined) {
            ip = target;
            continue;
          }
          break;
        }

        case IROpCode.JUMP_IF_FALSE: {
          const condValue = this._reg(instr.args[0]);
          if (!condValue) {
            const target = labelIndex.get(instr.args[1]);
            if (target !== undefined) {
              ip = target;
              continue;
            }
          }
          break;
        }

        case IROpCode.SET_CONFIG: {
          const key = instr.args[0];
          const val = this._reg(instr.args[1]);
          this.configUpdates.push({ key, value: val, unit: instr.args[2] });
          if (this.engine) {
            if (key === 'speed') this.engine.clock.speedMultiplier = val;
          }
          break;
        }

        case IROpCode.SET_SIGNAL: {
          const dir = instr.args[0];
          const state = this._reg(instr.args[1]);
          this.signalUpdates.push({ direction: dir, state });
          if (this.engine && this.engine.intersection) {
            this.engine.intersection.getSignal(dir).setState(state);
          }
          break;
        }

        case IROpCode.SPAWN_VEHICLE: {
          const dir = instr.args[0];
          const rate = this._reg(instr.args[1]);
          this.spawnUpdates.push({ direction: dir, rate, unit: instr.args[2] });
          if (this.engine && this.engine.spawner) {
            this.engine.spawner.setArrivalRate(dir, rate);
          }
          break;
        }

        case IROpCode.READ_QUEUE: {
          let queueValue = 0;
          if (this.sensors) {
            const snap = this.sensors.snapshot(this.engine?.currentTime ?? 0);
            queueValue = snap[instr.args[0]]?.queueLength ?? 0;
          }
          this.registers.set(instr.result, queueValue);
          break;
        }

        case IROpCode.READ_WAIT: {
          let waitValue = 0;
          if (this.sensors) {
            const snap = this.sensors.snapshot(this.engine?.currentTime ?? 0);
            waitValue = snap[instr.args[0]]?.avgWaitTime ?? 0;
          }
          this.registers.set(instr.result, waitValue);
          break;
        }

        case IROpCode.READ_EMERGENCY: {
          let hasEmergency = false;
          if (this.engine) {
            const lane = this.engine.intersection.getInboundLane(instr.args[0]);
            hasEmergency = lane.vehicles.some(v => v.type === 'emergency' && !v.isDeparted);
          }
          this.registers.set(instr.result, hasEmergency);
          break;
        }

        case IROpCode.EXTEND_GREEN:
          this.extendUpdates.push({
            target: instr.args[0],
            amount: this._reg(instr.args[1]),
            unit: instr.args[2],
          });
          break;

        case IROpCode.PRINT:
          this.output.push(this._reg(instr.args[0]));
          break;

        case IROpCode.LABEL:
          // Labels are no-ops during execution
          break;

        case IROpCode.NOP:
          break;

        case IROpCode.HALT:
          return this._buildResult(stepCount);
      }

      ip++;
    }

    return this._buildResult(stepCount);
  }

  /**
   * Read a register value.
   * @param {string} name
   * @returns {*}
   * @private
   */
  _reg(name) {
    return this.registers.get(name) ?? 0;
  }

  /**
   * Build the execution result.
   * @param {number} stepCount
   * @returns {ExecutionResult}
   * @private
   */
  _buildResult(stepCount) {
    return {
      output: this.output,
      configUpdates: this.configUpdates,
      signalUpdates: this.signalUpdates,
      spawnUpdates: this.spawnUpdates,
      extendUpdates: this.extendUpdates,
      variables: Object.fromEntries(this.variables),
      stepCount,
    };
  }

  /**
   * Reset executor state.
   */
  reset() {
    this.registers.clear();
    this.variables.clear();
    this.output = [];
    this.configUpdates = [];
    this.signalUpdates = [];
    this.spawnUpdates = [];
    this.extendUpdates = [];
  }
}

/**
 * @typedef {Object} ExecutionResult
 * @property {Array} output - Printed values
 * @property {Array} configUpdates - Config change commands
 * @property {Array} signalUpdates - Signal change commands
 * @property {Array} spawnUpdates - Spawn rate commands
 * @property {Array} extendUpdates - Green extension commands
 * @property {Object} variables - Final variable state
 * @property {number} stepCount - Total instructions executed
 */
