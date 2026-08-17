/**
 * ANTIGRAVITY — DSL Compiler Test Suite
 * 
 * Tests for:
 * - Lexer (Tokenization, units, numbers, identifiers, strings, errors)
 * - Parser (AST generation, precedence, error handling)
 * - Semantic Analyzer (Validation, symbol table, warnings, errors)
 * - IR Generator (IR instruction generation, labels, jumps)
 * - IR Optimizer (Constant folding, dead code elimination)
 * - Executor (IR execution, side-effect recording)
 * - Compiler Pipeline (End-to-end integration)
 * 
 * Run: node --test tests/compiler.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Lexer,
  TokenType,
  Parser,
  NodeType,
  SemanticAnalyzer,
  IRGenerator,
  IROpCode,
  IROptimizer,
  Executor,
  Compiler,
} from '../source/compiler/index.js';

// ─── Lexer Tests ──────────────────────────────────────────

describe('DSL Lexer', () => {
  it('tokenizes simple keywords and identifiers', () => {
    const lexer = new Lexer('scenario TestScenario { config speed = 1 }');
    const { tokens, errors } = lexer.tokenize();

    assert.equal(errors.length, 0);
    assert.equal(tokens[0].type, TokenType.KEYWORD);
    assert.equal(tokens[0].value, 'scenario');
    assert.equal(tokens[1].type, TokenType.IDENTIFIER);
    assert.equal(tokens[1].value, 'TestScenario');
    assert.equal(tokens[2].type, TokenType.LBRACE);
    assert.equal(tokens[3].type, TokenType.KEYWORD);
    assert.equal(tokens[3].value, 'config');
  });

  it('tokenizes numbers with units', () => {
    const lexer = new Lexer('10s 100ms 50m 30vpm 60km/h');
    const { tokens, errors } = lexer.tokenize();

    assert.equal(errors.length, 0);
    // 10s -> NUMBER 10, UNIT s
    assert.equal(tokens[0].type, TokenType.NUMBER);
    assert.equal(tokens[0].value, 10);
    assert.equal(tokens[1].type, TokenType.UNIT);
    assert.equal(tokens[1].value, 's');

    // 100ms -> NUMBER 100, UNIT ms
    assert.equal(tokens[2].type, TokenType.NUMBER);
    assert.equal(tokens[2].value, 100);
    assert.equal(tokens[3].type, TokenType.UNIT);
    assert.equal(tokens[3].value, 'ms');
  });

  it('tokenizes strings and comments', () => {
    const lexer = new Lexer(`
      // Single line comment
      config description = "Heavy Rush Hour"
    `);
    const { tokens, errors } = lexer.tokenize();

    assert.equal(errors.length, 0);
    const strToken = tokens.find(t => t.type === TokenType.STRING);
    assert.ok(strToken);
    assert.equal(strToken.value, 'Heavy Rush Hour');
  });
});

// ─── Parser Tests ─────────────────────────────────────────

describe('DSL Parser', () => {
  it('parses scenario declaration', () => {
    const lexer = new Lexer(`
      scenario HeavyTraffic {
        config duration = 300s
      }
    `);
    const { tokens } = lexer.tokenize();
    const parser = new Parser(tokens);
    const { ast, errors } = parser.parse();

    assert.equal(errors.length, 0);
    assert.equal(ast.type, NodeType.PROGRAM);
    assert.equal(ast.body[0].type, NodeType.SCENARIO_DECL);
    assert.equal(ast.body[0].name, 'HeavyTraffic');
    assert.equal(ast.body[0].body[0].type, NodeType.CONFIG_STMT);
  });

  it('parses rules with expressions', () => {
    const lexer = new Lexer(`
      when queue north > 10 and wait north > 30s {
        extend green north by 15s
      }
    `);
    const { tokens } = lexer.tokenize();
    const parser = new Parser(tokens);
    const { ast, errors } = parser.parse();

    assert.equal(errors.length, 0);
    assert.equal(ast.body[0].type, NodeType.RULE_DECL);
    assert.equal(ast.body[0].condition.type, NodeType.BINARY_EXPR);
    assert.equal(ast.body[0].condition.op, 'and');
  });
});

// ─── Semantic Analyzer Tests ─────────────────────────────

describe('Semantic Analyzer', () => {
  it('validates correct program', () => {
    const code = `
      scenario Normal {
        config duration = 300s
        spawn vehicle at north rate 20vpm
      }
    `;
    const { tokens } = new Lexer(code).tokenize();
    const { ast } = new Parser(tokens).parse();
    const semantic = new SemanticAnalyzer();
    const result = semantic.analyze(ast);

    assert.equal(result.errors.length, 0);
  });

  it('detects invalid direction', () => {
    const code = `
      spawn vehicle at upward rate 20vpm
    `;
    const { tokens } = new Lexer(code).tokenize();
    const { ast } = new Parser(tokens).parse();
    const semantic = new SemanticAnalyzer();
    const result = semantic.analyze(ast);

    assert.ok(result.errors.length > 0);
    assert.match(result.errors[0].message, /Invalid direction/);
  });
});

// ─── IR Generator & Optimizer Tests ─────────────────────

describe('IR Generator & Optimizer', () => {
  it('generates IR instructions and optimizes constant folding', () => {
    const code = `
      config duration = 10 + 20
    `;
    const { tokens } = new Lexer(code).tokenize();
    const { ast } = new Parser(tokens).parse();
    const irGen = new IRGenerator();
    const { instructions } = irGen.generate(ast);

    assert.ok(instructions.length > 0);

    const optimizer = new IROptimizer();
    const opt = optimizer.optimize(instructions);

    assert.ok(opt.optimizations.length > 0);
    // 10 + 20 should fold to 30
    const loadConst = opt.instructions.find(i => i.op === IROpCode.LOAD_CONST);
    assert.equal(loadConst.args[0], 30);
  });
});

// ─── End-to-End Compiler Tests ────────────────────────────

describe('Compiler End-to-End Pipeline', () => {
  it('compiles and executes DSL program successfully', () => {
    const dslCode = `
      scenario EmergencyPriority {
        config speed = 1
        spawn vehicle at north rate 30vpm
        when emergency at north {
          print "Emergency detected at north"
        }
      }
    `;

    const result = Compiler.compile(dslCode);
    assert.equal(result.success, true);
    assert.ok(result.stages.lexer);
    assert.ok(result.stages.parser);
    assert.ok(result.stages.semantic);
    assert.ok(result.stages.irGenerator);
    assert.ok(result.stages.optimizer);
    assert.ok(result.stages.executor);

    assert.equal(result.stages.executor.spawnUpdates.length, 1);
    assert.equal(result.stages.executor.spawnUpdates[0].direction, 'north');
    assert.equal(result.stages.executor.spawnUpdates[0].rate, 30);
  });
});
