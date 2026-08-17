/**
 * ANTIGRAVITY — Compiler Pipeline
 * 
 * Orchestrates the full compilation process:
 *   Source → Lexer → Parser → Semantic → IR → Optimizer → Executor
 * 
 * Provides both the complete pipeline and access to intermediate
 * results for visualization and debugging.
 */

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { SemanticAnalyzer } from './semantic.js';
import { IRGenerator } from './ir-generator.js';
import { IROptimizer } from './optimizer.js';
import { Executor } from './executor.js';

export class Compiler {
  /**
   * Compile and execute a DSL source program.
   * Returns all intermediate results for pipeline visualization.
   * 
   * @param {string} source - DSL source code
   * @param {Object} [context] - Simulation context for execution
   * @returns {CompilationResult}
   */
  static compile(source, context = {}) {
    const result = {
      source,
      stages: {},
      errors: [],
      warnings: [],
      success: true,
    };

    // Stage 1: Lexing
    const lexer = new Lexer(source);
    const lexResult = lexer.tokenize();
    result.stages.lexer = {
      tokens: lexResult.tokens,
      errors: lexResult.errors,
    };
    if (lexResult.errors.length > 0) {
      result.errors.push(...lexResult.errors.map(e => ({ stage: 'lexer', ...e })));
    }

    // Stage 2: Parsing
    const parser = new Parser(lexResult.tokens);
    const parseResult = parser.parse();
    result.stages.parser = {
      ast: parseResult.ast,
      errors: parseResult.errors,
    };
    if (parseResult.errors.length > 0) {
      result.errors.push(...parseResult.errors.map(e => ({ stage: 'parser', ...e })));
      result.success = false;
      return result;
    }

    // Stage 3: Semantic Analysis
    const semantic = new SemanticAnalyzer();
    const semResult = semantic.analyze(parseResult.ast);
    result.stages.semantic = {
      ast: semResult.ast,
      errors: semResult.errors,
      warnings: semResult.warnings,
      symbols: semResult.symbols,
    };
    if (semResult.errors.length > 0) {
      result.errors.push(...semResult.errors.map(e => ({ stage: 'semantic', ...e })));
      result.success = false;
      return result;
    }
    result.warnings.push(...semResult.warnings.map(w => ({ stage: 'semantic', ...w })));

    // Stage 4: IR Generation
    const irGen = new IRGenerator();
    const irResult = irGen.generate(semResult.ast);
    result.stages.irGenerator = {
      instructions: irResult.instructions,
    };

    // Stage 5: Optimization
    const optimizer = new IROptimizer();
    const optResult = optimizer.optimize(irResult.instructions);
    result.stages.optimizer = {
      instructions: optResult.instructions,
      optimizations: optResult.optimizations,
      beforeCount: irResult.instructions.length,
      afterCount: optResult.instructions.length,
    };

    // Stage 6: Execution
    const executor = new Executor(context);
    const execResult = executor.execute(optResult.instructions);
    result.stages.executor = execResult;

    return result;
  }
}

/**
 * @typedef {Object} CompilationResult
 * @property {string} source
 * @property {Object} stages - Intermediate results from each stage
 * @property {Array} errors - All compilation errors
 * @property {Array} warnings - All compilation warnings
 * @property {boolean} success - Whether compilation succeeded
 */
