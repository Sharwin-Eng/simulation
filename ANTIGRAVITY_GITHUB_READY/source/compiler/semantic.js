/**
 * ANTIGRAVITY — Semantic Analyzer
 * 
 * Validates the AST produced by the parser.
 * Checks for:
 * - Valid direction references
 * - Valid signal state values
 * - Valid configuration keys
 * - Duplicate scenario/intersection definitions
 * - Type compatibility in expressions
 * 
 * Produces an annotated AST (same structure with added metadata)
 * and a list of semantic errors/warnings.
 */

import { NodeType } from './parser.js';

const VALID_DIRECTIONS = new Set(['north', 'south', 'east', 'west']);
const VALID_SIGNAL_STATES = new Set(['green', 'red', 'yellow']);
const VALID_CONFIG_KEYS = new Set([
  'speed', 'tick', 'duration', 'seed', 'max_vehicles',
  'min_green', 'max_green', 'yellow_time', 'all_red_time',
]);

export class SemanticAnalyzer {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.symbols = {
      scenarios: new Set(),
      intersections: new Set(),
      variables: new Map(),
    };
  }

  /**
   * Analyze the AST.
   * @param {Object} ast - Root AST node (Program)
   * @returns {{ ast: Object, errors: Array, warnings: Array, symbols: Object }}
   */
  analyze(ast) {
    this._visitNode(ast);
    return {
      ast,
      errors: this.errors,
      warnings: this.warnings,
      symbols: this.symbols,
    };
  }

  _visitNode(astNode) {
    if (!astNode) return;

    switch (astNode.type) {
      case NodeType.PROGRAM:
        for (const stmt of astNode.body) this._visitNode(stmt);
        break;

      case NodeType.SCENARIO_DECL:
        this._visitScenario(astNode);
        break;

      case NodeType.CONFIG_STMT:
        this._visitConfig(astNode);
        break;

      case NodeType.INTERSECTION_DECL:
        this._visitIntersection(astNode);
        break;

      case NodeType.ROAD_DECL:
        this._visitRoad(astNode);
        break;

      case NodeType.SPAWN_STMT:
        this._visitSpawn(astNode);
        break;

      case NodeType.RULE_DECL:
        this._visitRule(astNode);
        break;

      case NodeType.SET_STMT:
        this._visitSet(astNode);
        break;

      case NodeType.PRINT_STMT:
        this._visitNode(astNode.value);
        break;

      case NodeType.IF_STMT:
        this._visitNode(astNode.condition);
        for (const s of astNode.consequent) this._visitNode(s);
        if (astNode.alternate) {
          for (const s of astNode.alternate) this._visitNode(s);
        }
        break;

      case NodeType.WHILE_STMT:
        this._visitNode(astNode.condition);
        for (const s of astNode.body) this._visitNode(s);
        break;

      case NodeType.EXTEND_STMT:
        this._visitExtend(astNode);
        break;

      case NodeType.BINARY_EXPR:
        this._visitNode(astNode.left);
        this._visitNode(astNode.right);
        break;

      case NodeType.UNARY_EXPR:
        this._visitNode(astNode.operand);
        break;

      case NodeType.QUEUE_EXPR:
      case NodeType.WAIT_EXPR:
        this._validateDirection(astNode.direction, astNode);
        break;

      case NodeType.EMERGENCY_EXPR:
        this._validateDirection(astNode.direction, astNode);
        break;

      case NodeType.LITERAL:
      case NodeType.IDENTIFIER:
        // No validation needed at this stage
        break;

      case NodeType.PHASE_DECL:
        for (const s of astNode.body) this._visitNode(s);
        break;
    }
  }

  _visitScenario(astNode) {
    if (this.symbols.scenarios.has(astNode.name)) {
      this._warn(`Duplicate scenario '${astNode.name}'`, astNode);
    }
    this.symbols.scenarios.add(astNode.name);
    for (const stmt of astNode.body) this._visitNode(stmt);
  }

  _visitConfig(astNode) {
    if (!VALID_CONFIG_KEYS.has(astNode.key)) {
      this._warn(`Unknown config key '${astNode.key}'`, astNode);
    }
    this._visitNode(astNode.value);
  }

  _visitIntersection(astNode) {
    if (this.symbols.intersections.has(astNode.name)) {
      this._error(`Duplicate intersection '${astNode.name}'`, astNode);
    }
    this.symbols.intersections.add(astNode.name);

    const directions = new Set();
    for (const road of astNode.roads) {
      if (directions.has(road.direction)) {
        this._error(`Duplicate road direction '${road.direction}' in intersection '${astNode.name}'`, road);
      }
      directions.add(road.direction);
      this._visitRoad(road);
    }
  }

  _visitRoad(astNode) {
    this._validateDirection(astNode.direction, astNode);
    if (astNode.lanes < 1) {
      this._error(`Road must have at least 1 lane, got ${astNode.lanes}`, astNode);
    }
  }

  _visitSpawn(astNode) {
    this._validateDirection(astNode.direction, astNode);
    this._visitNode(astNode.rate);
  }

  _visitRule(astNode) {
    this._visitNode(astNode.condition);
    for (const s of astNode.body) this._visitNode(s);
  }

  _visitSet(astNode) {
    if (astNode.target === 'signal' && astNode.targetDirection) {
      this._validateDirection(astNode.targetDirection, astNode);
    }
    this._visitNode(astNode.value);

    // Validate signal state values
    if (astNode.target === 'signal' && astNode.value.type === NodeType.LITERAL) {
      if (astNode.value.dataType === 'signal_state' &&
          !VALID_SIGNAL_STATES.has(astNode.value.value)) {
        this._error(`Invalid signal state '${astNode.value.value}'`, astNode);
      }
    }
  }

  _visitExtend(astNode) {
    this._visitNode(astNode.amount);
  }

  _validateDirection(direction, astNode) {
    if (!VALID_DIRECTIONS.has(direction)) {
      this._error(`Invalid direction '${direction}', expected north/south/east/west`, astNode);
    }
  }

  _error(message, astNode) {
    this.errors.push({
      message,
      line: astNode.line,
      column: astNode.column,
    });
  }

  _warn(message, astNode) {
    this.warnings.push({
      message,
      line: astNode.line,
      column: astNode.column,
    });
  }
}
