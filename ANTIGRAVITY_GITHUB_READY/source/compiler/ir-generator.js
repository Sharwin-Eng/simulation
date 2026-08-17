/**
 * ANTIGRAVITY — IR Generator
 * 
 * Transforms the AST into a flat Intermediate Representation (IR).
 * The IR is a linear sequence of instructions that can be optimized
 * and then executed by the IR executor.
 * 
 * IR instructions use a register-based model with named registers.
 */

import { NodeType } from './parser.js';

// ─── IR Operation Codes ───────────────────────────────────

export const IROpCode = Object.freeze({
  LOAD_CONST: 'LOAD_CONST',
  LOAD_VAR: 'LOAD_VAR',
  STORE_VAR: 'STORE_VAR',
  ADD: 'ADD',
  SUB: 'SUB',
  MUL: 'MUL',
  DIV: 'DIV',
  CMP_EQ: 'CMP_EQ',
  CMP_NEQ: 'CMP_NEQ',
  CMP_GT: 'CMP_GT',
  CMP_LT: 'CMP_LT',
  CMP_GTE: 'CMP_GTE',
  CMP_LTE: 'CMP_LTE',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  NEGATE: 'NEGATE',
  JUMP: 'JUMP',
  JUMP_IF_FALSE: 'JUMP_IF_FALSE',
  SET_CONFIG: 'SET_CONFIG',
  SET_SIGNAL: 'SET_SIGNAL',
  SPAWN_VEHICLE: 'SPAWN_VEHICLE',
  READ_QUEUE: 'READ_QUEUE',
  READ_WAIT: 'READ_WAIT',
  READ_EMERGENCY: 'READ_EMERGENCY',
  EXTEND_GREEN: 'EXTEND_GREEN',
  PRINT: 'PRINT',
  LABEL: 'LABEL',
  HALT: 'HALT',
  NOP: 'NOP',
});

// ─── IR Instruction ───────────────────────────────────────

export class IRInstruction {
  /**
   * @param {string} op - Operation code
   * @param {Array} args - Instruction arguments
   * @param {string|null} result - Result register name
   * @param {number} [line] - Source line for debugging
   */
  constructor(op, args = [], result = null, line = 0) {
    this.op = op;
    this.args = args;
    this.result = result;
    this.line = line;
  }

  toString() {
    const resultStr = this.result ? `${this.result} = ` : '';
    const argsStr = this.args.map(a => JSON.stringify(a)).join(', ');
    return `${resultStr}${this.op}(${argsStr})`;
  }
}

// ─── IR Generator ─────────────────────────────────────────

export class IRGenerator {
  constructor() {
    this.instructions = [];
    this._registerCounter = 0;
    this._labelCounter = 0;
  }

  /**
   * Generate IR from an AST.
   * @param {Object} ast - Root AST node
   * @returns {{ instructions: IRInstruction[] }}
   */
  generate(ast) {
    this._visitNode(ast);
    this._emit(IROpCode.HALT, [], null, 0);
    return { instructions: this.instructions };
  }

  _newRegister() {
    return `r${this._registerCounter++}`;
  }

  _newLabel() {
    return `L${this._labelCounter++}`;
  }

  _emit(op, args = [], result = null, line = 0) {
    const instr = new IRInstruction(op, args, result, line);
    this.instructions.push(instr);
    return instr;
  }

  _visitNode(astNode) {
    if (!astNode) return null;

    switch (astNode.type) {
      case NodeType.PROGRAM:
        for (const stmt of astNode.body) this._visitNode(stmt);
        return null;

      case NodeType.SCENARIO_DECL:
        // Scenarios are flattened — just process the body
        for (const stmt of astNode.body) this._visitNode(stmt);
        return null;

      case NodeType.CONFIG_STMT:
        return this._genConfig(astNode);

      case NodeType.INTERSECTION_DECL:
        // Intersection declaration is structural — no runtime IR needed
        // (intersection is always pre-created by the engine)
        return null;

      case NodeType.SPAWN_STMT:
        return this._genSpawn(astNode);

      case NodeType.RULE_DECL:
        return this._genRule(astNode);

      case NodeType.SET_STMT:
        return this._genSet(astNode);

      case NodeType.PRINT_STMT:
        return this._genPrint(astNode);

      case NodeType.IF_STMT:
        return this._genIf(astNode);

      case NodeType.WHILE_STMT:
        return this._genWhile(astNode);

      case NodeType.EXTEND_STMT:
        return this._genExtend(astNode);

      case NodeType.PHASE_DECL:
        for (const stmt of astNode.body) this._visitNode(stmt);
        return null;

      case NodeType.BINARY_EXPR:
        return this._genBinary(astNode);

      case NodeType.UNARY_EXPR:
        return this._genUnary(astNode);

      case NodeType.LITERAL:
        return this._genLiteral(astNode);

      case NodeType.IDENTIFIER:
        return this._genIdentifier(astNode);

      case NodeType.QUEUE_EXPR:
        return this._genQueueRead(astNode);

      case NodeType.WAIT_EXPR:
        return this._genWaitRead(astNode);

      case NodeType.EMERGENCY_EXPR:
        return this._genEmergencyRead(astNode);

      default:
        return null;
    }
  }

  _genConfig(astNode) {
    const valueReg = this._visitNode(astNode.value);
    this._emit(IROpCode.SET_CONFIG, [astNode.key, valueReg, astNode.unit], null, astNode.line);
    return null;
  }

  _genSpawn(astNode) {
    const rateReg = this._visitNode(astNode.rate);
    this._emit(IROpCode.SPAWN_VEHICLE, [astNode.direction, rateReg, astNode.unit], null, astNode.line);
    return null;
  }

  _genRule(astNode) {
    // when condition { body } → if condition then body
    const condReg = this._visitNode(astNode.condition);
    const endLabel = this._newLabel();
    this._emit(IROpCode.JUMP_IF_FALSE, [condReg, endLabel], null, astNode.line);
    for (const stmt of astNode.body) this._visitNode(stmt);
    this._emit(IROpCode.LABEL, [endLabel], null, astNode.line);
    return null;
  }

  _genSet(astNode) {
    const valueReg = this._visitNode(astNode.value);
    if (astNode.target === 'signal') {
      this._emit(IROpCode.SET_SIGNAL, [astNode.targetDirection, valueReg], null, astNode.line);
    } else {
      this._emit(IROpCode.STORE_VAR, [astNode.target, valueReg], null, astNode.line);
    }
    return null;
  }

  _genPrint(astNode) {
    const valueReg = this._visitNode(astNode.value);
    this._emit(IROpCode.PRINT, [valueReg], null, astNode.line);
    return null;
  }

  _genIf(astNode) {
    const condReg = this._visitNode(astNode.condition);
    const elseLabel = this._newLabel();
    const endLabel = this._newLabel();

    this._emit(IROpCode.JUMP_IF_FALSE, [condReg, elseLabel], null, astNode.line);
    for (const stmt of astNode.consequent) this._visitNode(stmt);
    this._emit(IROpCode.JUMP, [endLabel], null, astNode.line);
    this._emit(IROpCode.LABEL, [elseLabel], null, astNode.line);
    if (astNode.alternate) {
      for (const stmt of astNode.alternate) this._visitNode(stmt);
    }
    this._emit(IROpCode.LABEL, [endLabel], null, astNode.line);
    return null;
  }

  _genWhile(astNode) {
    const startLabel = this._newLabel();
    const endLabel = this._newLabel();

    this._emit(IROpCode.LABEL, [startLabel], null, astNode.line);
    const condReg = this._visitNode(astNode.condition);
    this._emit(IROpCode.JUMP_IF_FALSE, [condReg, endLabel], null, astNode.line);
    for (const stmt of astNode.body) this._visitNode(stmt);
    this._emit(IROpCode.JUMP, [startLabel], null, astNode.line);
    this._emit(IROpCode.LABEL, [endLabel], null, astNode.line);
    return null;
  }

  _genExtend(astNode) {
    const amountReg = this._visitNode(astNode.amount);
    this._emit(IROpCode.EXTEND_GREEN, [astNode.target, amountReg, astNode.unit], null, astNode.line);
    return null;
  }

  _genBinary(astNode) {
    const leftReg = this._visitNode(astNode.left);
    const rightReg = this._visitNode(astNode.right);
    const resultReg = this._newRegister();

    const opMap = {
      '+': IROpCode.ADD, '-': IROpCode.SUB,
      '*': IROpCode.MUL, '/': IROpCode.DIV,
      '==': IROpCode.CMP_EQ, '!=': IROpCode.CMP_NEQ,
      '>': IROpCode.CMP_GT, '<': IROpCode.CMP_LT,
      '>=': IROpCode.CMP_GTE, '<=': IROpCode.CMP_LTE,
      'and': IROpCode.AND, 'or': IROpCode.OR,
    };

    const irOp = opMap[astNode.op];
    if (!irOp) {
      throw new Error(`Unknown binary operator: ${astNode.op}`);
    }

    this._emit(irOp, [leftReg, rightReg], resultReg, astNode.line);
    return resultReg;
  }

  _genUnary(astNode) {
    const operandReg = this._visitNode(astNode.operand);
    const resultReg = this._newRegister();

    if (astNode.op === 'not') {
      this._emit(IROpCode.NOT, [operandReg], resultReg, astNode.line);
    } else if (astNode.op === '-') {
      this._emit(IROpCode.NEGATE, [operandReg], resultReg, astNode.line);
    }

    return resultReg;
  }

  _genLiteral(astNode) {
    const reg = this._newRegister();
    this._emit(IROpCode.LOAD_CONST, [astNode.value], reg, astNode.line);
    return reg;
  }

  _genIdentifier(astNode) {
    const reg = this._newRegister();
    this._emit(IROpCode.LOAD_VAR, [astNode.name], reg, astNode.line);
    return reg;
  }

  _genQueueRead(astNode) {
    const reg = this._newRegister();
    this._emit(IROpCode.READ_QUEUE, [astNode.direction], reg, astNode.line);
    return reg;
  }

  _genWaitRead(astNode) {
    const reg = this._newRegister();
    this._emit(IROpCode.READ_WAIT, [astNode.direction], reg, astNode.line);
    return reg;
  }

  _genEmergencyRead(astNode) {
    const reg = this._newRegister();
    this._emit(IROpCode.READ_EMERGENCY, [astNode.direction], reg, astNode.line);
    return reg;
  }
}
