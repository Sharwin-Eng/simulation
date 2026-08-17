/**
 * ANTIGRAVITY — IR Optimizer
 * 
 * Performs optimization passes on the IR instruction list:
 * 
 * 1. Constant Folding — evaluate constant expressions at compile time
 * 2. Dead Code Elimination — remove unreachable instructions after unconditional jumps
 * 3. NOP Removal — strip NOP instructions
 * 
 * Each pass is independent and can be enabled/disabled.
 */

import { IROpCode, IRInstruction } from './ir-generator.js';

export class IROptimizer {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.constantFolding] - Enable constant folding (default true)
   * @param {boolean} [options.deadCodeElimination] - Enable DCE (default true)
   */
  constructor(options = {}) {
    this.constantFolding = options.constantFolding ?? true;
    this.deadCodeElimination = options.deadCodeElimination ?? true;
  }

  /**
   * Optimize the IR instruction list.
   * @param {IRInstruction[]} instructions
   * @returns {{ instructions: IRInstruction[], optimizations: string[] }}
   */
  optimize(instructions) {
    let ir = [...instructions];
    const optimizations = [];

    if (this.constantFolding) {
      const result = this._constantFold(ir);
      ir = result.ir;
      if (result.count > 0) {
        optimizations.push(`Constant folding: ${result.count} expressions folded`);
      }
    }

    if (this.deadCodeElimination) {
      const result = this._eliminateDeadCode(ir);
      ir = result.ir;
      if (result.count > 0) {
        optimizations.push(`Dead code elimination: ${result.count} instructions removed`);
      }
    }

    // Remove NOPs
    const beforeNop = ir.length;
    ir = ir.filter(i => i.op !== IROpCode.NOP);
    const nopsRemoved = beforeNop - ir.length;
    if (nopsRemoved > 0) {
      optimizations.push(`NOP removal: ${nopsRemoved} NOPs removed`);
    }

    return { instructions: ir, optimizations };
  }

  /**
   * Constant folding: evaluate binary operations on two LOAD_CONST results.
   * @param {IRInstruction[]} ir
   * @returns {{ ir: IRInstruction[], count: number }}
   * @private
   */
  _constantFold(ir) {
    let count = 0;
    // Build a map of register → constant value
    const constRegs = new Map();

    for (let i = 0; i < ir.length; i++) {
      const instr = ir[i];

      if (instr.op === IROpCode.LOAD_CONST && instr.result) {
        constRegs.set(instr.result, instr.args[0]);
      }

      // Fold binary operations where both operands are constants
      if ([IROpCode.ADD, IROpCode.SUB, IROpCode.MUL, IROpCode.DIV,
           IROpCode.CMP_EQ, IROpCode.CMP_NEQ, IROpCode.CMP_GT,
           IROpCode.CMP_LT, IROpCode.CMP_GTE, IROpCode.CMP_LTE].includes(instr.op)) {
        const leftVal = constRegs.get(instr.args[0]);
        const rightVal = constRegs.get(instr.args[1]);

        if (leftVal !== undefined && rightVal !== undefined) {
          let result;
          switch (instr.op) {
            case IROpCode.ADD: result = leftVal + rightVal; break;
            case IROpCode.SUB: result = leftVal - rightVal; break;
            case IROpCode.MUL: result = leftVal * rightVal; break;
            case IROpCode.DIV: result = rightVal !== 0 ? leftVal / rightVal : 0; break;
            case IROpCode.CMP_EQ: result = leftVal === rightVal; break;
            case IROpCode.CMP_NEQ: result = leftVal !== rightVal; break;
            case IROpCode.CMP_GT: result = leftVal > rightVal; break;
            case IROpCode.CMP_LT: result = leftVal < rightVal; break;
            case IROpCode.CMP_GTE: result = leftVal >= rightVal; break;
            case IROpCode.CMP_LTE: result = leftVal <= rightVal; break;
          }

          // Replace with LOAD_CONST
          ir[i] = new IRInstruction(IROpCode.LOAD_CONST, [result], instr.result, instr.line);
          constRegs.set(instr.result, result);
          count++;
        }
      }

      // Fold NEGATE of constant
      if (instr.op === IROpCode.NEGATE) {
        const val = constRegs.get(instr.args[0]);
        if (val !== undefined) {
          ir[i] = new IRInstruction(IROpCode.LOAD_CONST, [-val], instr.result, instr.line);
          constRegs.set(instr.result, -val);
          count++;
        }
      }

      // Fold NOT of constant
      if (instr.op === IROpCode.NOT) {
        const val = constRegs.get(instr.args[0]);
        if (val !== undefined) {
          ir[i] = new IRInstruction(IROpCode.LOAD_CONST, [!val], instr.result, instr.line);
          constRegs.set(instr.result, !val);
          count++;
        }
      }
    }

    return { ir, count };
  }

  /**
   * Dead code elimination: remove instructions after unconditional jumps
   * that are not label targets.
   * @param {IRInstruction[]} ir
   * @returns {{ ir: IRInstruction[], count: number }}
   * @private
   */
  _eliminateDeadCode(ir) {
    // Collect all label targets
    const usedLabels = new Set();
    for (const instr of ir) {
      if (instr.op === IROpCode.JUMP || instr.op === IROpCode.JUMP_IF_FALSE) {
        const labelArg = instr.op === IROpCode.JUMP ? instr.args[0] : instr.args[1];
        usedLabels.add(labelArg);
      }
    }

    // Mark instructions after unconditional jumps as dead (unless they're labels)
    const alive = new Array(ir.length).fill(true);
    let afterJump = false;
    let count = 0;

    for (let i = 0; i < ir.length; i++) {
      if (afterJump) {
        if (ir[i].op === IROpCode.LABEL) {
          afterJump = false; // Label is reachable from a jump
        } else {
          alive[i] = false;
          count++;
        }
      }

      if (ir[i].op === IROpCode.JUMP) {
        afterJump = true;
      } else if (ir[i].op !== IROpCode.NOP) {
        afterJump = false;
      }
    }

    const result = ir.filter((_, i) => alive[i]);
    return { ir: result, count };
  }
}
