/**
 * ANTIGRAVITY — DSL Parser
 * 
 * Recursive-descent parser that transforms a token stream into
 * an Abstract Syntax Tree (AST). The parser validates syntax and
 * produces structured AST nodes for the semantic analyzer.
 * 
 * Grammar precedence (lowest to highest):
 *   or → and → comparison → addition → multiplication → unary → primary
 */

import { TokenType } from './lexer.js';

// ─── AST Node Types ───────────────────────────────────────

export const NodeType = Object.freeze({
  PROGRAM: 'Program',
  SCENARIO_DECL: 'ScenarioDecl',
  CONFIG_STMT: 'ConfigStmt',
  INTERSECTION_DECL: 'IntersectionDecl',
  ROAD_DECL: 'RoadDecl',
  PHASE_DECL: 'PhaseDecl',
  SPAWN_STMT: 'SpawnStmt',
  RULE_DECL: 'RuleDecl',
  SET_STMT: 'SetStmt',
  PRINT_STMT: 'PrintStmt',
  IF_STMT: 'IfStmt',
  WHILE_STMT: 'WhileStmt',
  EXTEND_STMT: 'ExtendStmt',
  BINARY_EXPR: 'BinaryExpr',
  UNARY_EXPR: 'UnaryExpr',
  LITERAL: 'Literal',
  IDENTIFIER: 'Identifier',
  QUEUE_EXPR: 'QueueExpr',
  WAIT_EXPR: 'WaitExpr',
  EMERGENCY_EXPR: 'EmergencyExpr',
});

// ─── AST Node Factory ────────────────────────────────────

function node(type, props, line, column) {
  return { type, ...props, line, column };
}

// ─── Parser ──────────────────────────────────────────────

export class Parser {
  /**
   * @param {import('./lexer.js').Token[]} tokens
   */
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.errors = [];
  }

  /**
   * Parse the token stream into an AST.
   * @returns {{ ast: Object, errors: ParserError[] }}
   */
  parse() {
    const statements = [];

    while (!this._isAtEnd()) {
      try {
        const stmt = this._parseStatement();
        if (stmt) statements.push(stmt);
      } catch (e) {
        this.errors.push({
          message: e.message,
          line: this._current().line,
          column: this._current().column,
        });
        this._synchronize();
      }
    }

    return {
      ast: node(NodeType.PROGRAM, { body: statements }, 1, 1),
      errors: this.errors,
    };
  }

  // ─── Statement Parsing ────────────────────────────────

  _parseStatement() {
    const token = this._current();

    if (token.type === TokenType.KEYWORD) {
      switch (token.value) {
        case 'scenario':     return this._parseScenarioDecl();
        case 'config':       return this._parseConfigStmt();
        case 'intersection': return this._parseIntersectionDecl();
        case 'spawn':        return this._parseSpawnStmt();
        case 'when':         return this._parseRuleDecl();
        case 'set':          return this._parseSetStmt();
        case 'print':        return this._parsePrintStmt();
        case 'if':           return this._parseIfStmt();
        case 'while':        return this._parseWhileStmt();
        case 'extend':       return this._parseExtendStmt();
        case 'phase':        return this._parsePhaseDecl();
      }
    }

    // If we get here, it's an unexpected token
    this._error(`Unexpected token: ${token.type} '${token.value}'`);
    this._advance();
    return null;
  }

  _parseScenarioDecl() {
    const token = this._expect(TokenType.KEYWORD, 'scenario');
    const name = this._expect(TokenType.IDENTIFIER).value;
    this._expect(TokenType.LBRACE);
    const body = this._parseBlock();
    this._expect(TokenType.RBRACE);
    return node(NodeType.SCENARIO_DECL, { name, body }, token.line, token.column);
  }

  _parseConfigStmt() {
    const token = this._expect(TokenType.KEYWORD, 'config');
    const keyToken = this._current();
    if (keyToken.type !== TokenType.IDENTIFIER && keyToken.type !== TokenType.KEYWORD) {
      this._error(`Expected config key name, got ${keyToken.type} '${keyToken.value}'`);
    }
    const key = this._advance().value;
    this._expect(TokenType.EQUALS);
    const value = this._parseExpression();
    const unit = this._tryConsumeUnit();
    return node(NodeType.CONFIG_STMT, { key, value, unit }, token.line, token.column);
  }

  _parseIntersectionDecl() {
    const token = this._expect(TokenType.KEYWORD, 'intersection');
    const name = this._expect(TokenType.IDENTIFIER).value;
    this._expect(TokenType.LBRACE);
    const roads = [];
    while (!this._check(TokenType.RBRACE) && !this._isAtEnd()) {
      roads.push(this._parseRoadDecl());
    }
    this._expect(TokenType.RBRACE);
    return node(NodeType.INTERSECTION_DECL, { name, roads }, token.line, token.column);
  }

  _parseRoadDecl() {
    const token = this._expect(TokenType.KEYWORD, 'road');
    const direction = this._expectDirection();
    this._expect(TokenType.LBRACE);
    this._expect(TokenType.KEYWORD, 'lanes');
    const lanes = this._expect(TokenType.NUMBER).value;
    this._expect(TokenType.RBRACE);
    return node(NodeType.ROAD_DECL, { direction, lanes }, token.line, token.column);
  }

  _parsePhaseDecl() {
    const token = this._expect(TokenType.KEYWORD, 'phase');
    const name = this._expect(TokenType.IDENTIFIER).value;
    this._expect(TokenType.LBRACE);
    const body = this._parseBlock();
    this._expect(TokenType.RBRACE);
    return node(NodeType.PHASE_DECL, { name, body }, token.line, token.column);
  }

  _parseSpawnStmt() {
    const token = this._expect(TokenType.KEYWORD, 'spawn');
    this._expect(TokenType.KEYWORD, 'vehicle');
    this._expect(TokenType.KEYWORD, 'at');
    const direction = this._expectDirection();
    this._expect(TokenType.KEYWORD, 'rate');
    const rate = this._parseExpression();
    const unit = this._tryConsumeUnit();
    return node(NodeType.SPAWN_STMT, { direction, rate, unit }, token.line, token.column);
  }

  _parseRuleDecl() {
    const token = this._expect(TokenType.KEYWORD, 'when');
    const condition = this._parseExpression();
    this._expect(TokenType.LBRACE);
    const body = this._parseBlock();
    this._expect(TokenType.RBRACE);
    return node(NodeType.RULE_DECL, { condition, body }, token.line, token.column);
  }

  _parseSetStmt() {
    const token = this._expect(TokenType.KEYWORD, 'set');
    // target: "signal north" or "phase name" or just identifier
    let target, targetDirection;

    if (this._checkKeyword('signal')) {
      this._advance();
      targetDirection = this._expectDirection();
      target = 'signal';
    } else if (this._checkKeyword('phase')) {
      this._advance();
      target = 'phase';
      targetDirection = this._expect(TokenType.IDENTIFIER).value;
    } else {
      target = this._expect(TokenType.IDENTIFIER).value;
      targetDirection = null;
    }

    this._expect(TokenType.KEYWORD, 'to');
    const value = this._parseExpression();
    return node(NodeType.SET_STMT, { target, targetDirection, value }, token.line, token.column);
  }

  _parsePrintStmt() {
    const token = this._expect(TokenType.KEYWORD, 'print');
    const value = this._parseExpression();
    return node(NodeType.PRINT_STMT, { value }, token.line, token.column);
  }

  _parseIfStmt() {
    const token = this._expect(TokenType.KEYWORD, 'if');
    const condition = this._parseExpression();
    this._expect(TokenType.LBRACE);
    const consequent = this._parseBlock();
    this._expect(TokenType.RBRACE);

    let alternate = null;
    if (this._checkKeyword('else')) {
      this._advance();
      this._expect(TokenType.LBRACE);
      alternate = this._parseBlock();
      this._expect(TokenType.RBRACE);
    }

    return node(NodeType.IF_STMT, { condition, consequent, alternate }, token.line, token.column);
  }

  _parseWhileStmt() {
    const token = this._expect(TokenType.KEYWORD, 'while');
    const condition = this._parseExpression();
    this._expect(TokenType.LBRACE);
    const body = this._parseBlock();
    this._expect(TokenType.RBRACE);
    return node(NodeType.WHILE_STMT, { condition, body }, token.line, token.column);
  }

  _parseExtendStmt() {
    const token = this._expect(TokenType.KEYWORD, 'extend');
    this._expect(TokenType.KEYWORD, 'green');
    // direction or phase identifier
    let target;
    if (this._isDirection(this._current())) {
      target = this._expectDirection();
    } else {
      target = this._expect(TokenType.IDENTIFIER).value;
    }
    this._expect(TokenType.KEYWORD, 'by');
    const amount = this._parseExpression();
    const unit = this._tryConsumeUnit();
    return node(NodeType.EXTEND_STMT, { target, amount, unit }, token.line, token.column);
  }

  // ─── Expression Parsing (Pratt-style precedence) ─────

  _parseExpression() {
    return this._parseOr();
  }

  _parseOr() {
    let left = this._parseAnd();
    while (this._checkKeyword('or')) {
      const op = this._advance();
      const right = this._parseAnd();
      left = node(NodeType.BINARY_EXPR, { op: 'or', left, right }, op.line, op.column);
    }
    return left;
  }

  _parseAnd() {
    let left = this._parseComparison();
    while (this._checkKeyword('and')) {
      const op = this._advance();
      const right = this._parseComparison();
      left = node(NodeType.BINARY_EXPR, { op: 'and', left, right }, op.line, op.column);
    }
    return left;
  }

  _parseComparison() {
    let left = this._parseAddition();
    const compOps = [TokenType.EQ, TokenType.NEQ, TokenType.GT, TokenType.LT, TokenType.GTE, TokenType.LTE];
    while (compOps.includes(this._current().type)) {
      const op = this._advance();
      const right = this._parseAddition();
      left = node(NodeType.BINARY_EXPR, { op: op.value, left, right }, op.line, op.column);
    }
    return left;
  }

  _parseAddition() {
    let left = this._parseMultiplication();
    while (this._check(TokenType.PLUS) || this._check(TokenType.MINUS)) {
      const op = this._advance();
      const right = this._parseMultiplication();
      left = node(NodeType.BINARY_EXPR, { op: op.value, left, right }, op.line, op.column);
    }
    return left;
  }

  _parseMultiplication() {
    let left = this._parseUnary();
    while (this._check(TokenType.STAR) || this._check(TokenType.SLASH)) {
      const op = this._advance();
      const right = this._parseUnary();
      left = node(NodeType.BINARY_EXPR, { op: op.value, left, right }, op.line, op.column);
    }
    return left;
  }

  _parseUnary() {
    if (this._checkKeyword('not')) {
      const op = this._advance();
      const operand = this._parseUnary();
      return node(NodeType.UNARY_EXPR, { op: 'not', operand }, op.line, op.column);
    }
    if (this._check(TokenType.MINUS)) {
      const op = this._advance();
      const operand = this._parseUnary();
      return node(NodeType.UNARY_EXPR, { op: '-', operand }, op.line, op.column);
    }
    return this._parsePrimary();
  }

  _parsePrimary() {
    const token = this._current();

    // Number literal
    if (token.type === TokenType.NUMBER) {
      this._advance();
      return node(NodeType.LITERAL, { value: token.value, dataType: 'number' }, token.line, token.column);
    }

    // String literal
    if (token.type === TokenType.STRING) {
      this._advance();
      return node(NodeType.LITERAL, { value: token.value, dataType: 'string' }, token.line, token.column);
    }

    // Boolean literal
    if (token.type === TokenType.BOOLEAN) {
      this._advance();
      return node(NodeType.LITERAL, { value: token.value, dataType: 'boolean' }, token.line, token.column);
    }

    // Queue expression: queue north
    if (this._checkKeyword('queue')) {
      this._advance();
      const direction = this._expectDirection();
      return node(NodeType.QUEUE_EXPR, { direction }, token.line, token.column);
    }

    // Wait expression: wait north
    if (this._checkKeyword('wait')) {
      this._advance();
      const direction = this._expectDirection();
      return node(NodeType.WAIT_EXPR, { direction }, token.line, token.column);
    }

    // Emergency expression: emergency at north
    if (this._checkKeyword('emergency')) {
      this._advance();
      this._expect(TokenType.KEYWORD, 'at');
      const direction = this._expectDirection();
      return node(NodeType.EMERGENCY_EXPR, { direction }, token.line, token.column);
    }

    // Direction keyword used as a value (e.g., in set statements)
    if (this._isDirection(token)) {
      this._advance();
      return node(NodeType.LITERAL, { value: token.value, dataType: 'direction' }, token.line, token.column);
    }

    // Signal state keywords used as values
    if (token.type === TokenType.KEYWORD && ['green', 'red', 'yellow'].includes(token.value)) {
      this._advance();
      return node(NodeType.LITERAL, { value: token.value, dataType: 'signal_state' }, token.line, token.column);
    }

    // Parenthesized expression
    if (token.type === TokenType.LPAREN) {
      this._advance();
      const expr = this._parseExpression();
      this._expect(TokenType.RPAREN);
      return expr;
    }

    // Identifier
    if (token.type === TokenType.IDENTIFIER) {
      this._advance();
      return node(NodeType.IDENTIFIER, { name: token.value }, token.line, token.column);
    }

    this._error(`Unexpected token in expression: ${token.type} '${token.value}'`);
    this._advance();
    return node(NodeType.LITERAL, { value: null, dataType: 'null' }, token.line, token.column);
  }

  // ─── Block Parsing ────────────────────────────────────

  _parseBlock() {
    const statements = [];
    while (!this._check(TokenType.RBRACE) && !this._isAtEnd()) {
      try {
        const stmt = this._parseStatement();
        if (stmt) statements.push(stmt);
      } catch (e) {
        this.errors.push({
          message: e.message,
          line: this._current().line,
          column: this._current().column,
        });
        this._synchronize();
      }
    }
    return statements;
  }

  // ─── Helper Methods ───────────────────────────────────

  _current() {
    return this.tokens[this.pos] || new (Object.getPrototypeOf(this.tokens[0]).constructor)(TokenType.EOF, null, 0, 0);
  }

  _advance() {
    const token = this.tokens[this.pos];
    if (!this._isAtEnd()) this.pos++;
    return token;
  }

  _check(type) {
    return this._current().type === type;
  }

  _checkKeyword(value) {
    const t = this._current();
    return t.type === TokenType.KEYWORD && t.value === value;
  }

  _isAtEnd() {
    return this._current().type === TokenType.EOF;
  }

  _expect(type, value) {
    const token = this._current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      const expected = value ? `${type} '${value}'` : type;
      this._error(`Expected ${expected}, got ${token.type} '${token.value}'`);
    }
    return this._advance();
  }

  _expectDirection() {
    const token = this._current();
    if (this._isDirection(token)) {
      return this._advance().value;
    }
    this._error(`Expected direction (north/south/east/west), got '${token.value}'`);
    return this._advance().value;
  }

  _isDirection(token) {
    return token.type === TokenType.KEYWORD &&
      ['north', 'south', 'east', 'west'].includes(token.value);
  }

  _tryConsumeUnit() {
    if (this._check(TokenType.UNIT)) {
      return this._advance().value;
    }
    return null;
  }

  _error(message) {
    throw new Error(message);
  }

  _synchronize() {
    // Skip tokens until we find a statement boundary
    while (!this._isAtEnd()) {
      const t = this._current();
      if (t.type === TokenType.RBRACE) return;
      if (t.type === TokenType.KEYWORD && [
        'scenario', 'config', 'intersection', 'spawn', 'when',
        'set', 'print', 'if', 'while', 'extend', 'phase',
      ].includes(t.value)) {
        return;
      }
      this._advance();
    }
  }
}
