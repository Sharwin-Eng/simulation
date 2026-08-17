/**
 * ANTIGRAVITY — DSL Lexer (Tokenizer)
 * 
 * Transforms raw DSL source text into a stream of tokens.
 * Handles keywords, identifiers, numbers, strings, operators,
 * delimiters, units, and comments.
 * 
 * The lexer is the first stage of the compiler pipeline.
 * It scans character-by-character, producing tokens with
 * type, value, line, and column information for error reporting.
 */

// ─── Token Types ──────────────────────────────────────────

export const TokenType = Object.freeze({
  // Literals
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  BOOLEAN: 'BOOLEAN',
  IDENTIFIER: 'IDENTIFIER',

  // Keywords
  KEYWORD: 'KEYWORD',

  // Operators
  PLUS: 'PLUS',           // +
  MINUS: 'MINUS',         // -
  STAR: 'STAR',           // *
  SLASH: 'SLASH',         // /
  EQUALS: 'EQUALS',       // =
  EQ: 'EQ',               // ==
  NEQ: 'NEQ',             // !=
  GT: 'GT',               // >
  LT: 'LT',              // <
  GTE: 'GTE',             // >=
  LTE: 'LTE',             // <=

  // Delimiters
  LPAREN: 'LPAREN',       // (
  RPAREN: 'RPAREN',       // )
  LBRACE: 'LBRACE',       // {
  RBRACE: 'RBRACE',       // }
  COMMA: 'COMMA',         // ,
  SEMICOLON: 'SEMICOLON', // ;
  COLON: 'COLON',         // :

  // Units
  UNIT: 'UNIT',

  // End of file
  EOF: 'EOF',
});

// ─── Keywords ─────────────────────────────────────────────

const KEYWORDS = new Set([
  'scenario', 'config', 'intersection', 'road', 'lanes',
  'signal', 'phase', 'when', 'set', 'spawn', 'vehicle',
  'green', 'red', 'yellow', 'duration', 'rate', 'speed',
  'emergency', 'if', 'else', 'while', 'print',
  'direction', 'north', 'south', 'east', 'west',
  'queue', 'wait', 'extend', 'by', 'to', 'for', 'at',
  'and', 'or', 'not', 'true', 'false',
]);

// ─── Units ────────────────────────────────────────────────

const UNITS = new Set(['s', 'ms', 'm', 'vpm']);

// Special multi-char unit
const MULTI_UNITS = { 'km/h': true };

// ─── Token Class ──────────────────────────────────────────

export class Token {
  /**
   * @param {string} type - TokenType value
   * @param {*} value - Token value
   * @param {number} line - Source line (1-indexed)
   * @param {number} column - Source column (1-indexed)
   */
  constructor(type, value, line, column) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
  }

  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, ${this.line}:${this.column})`;
  }
}

// ─── Lexer ────────────────────────────────────────────────

export class Lexer {
  /**
   * @param {string} source - DSL source code
   */
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
    this.errors = [];
  }

  /**
   * Tokenize the entire source.
   * @returns {{ tokens: Token[], errors: LexerError[] }}
   */
  tokenize() {
    while (this.pos < this.source.length) {
      this._skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      if (this._isDigit(ch)) {
        this._readNumber();
      } else if (this._isAlpha(ch) || ch === '_') {
        this._readIdentifierOrKeyword();
      } else if (ch === '"') {
        this._readString();
      } else {
        this._readOperatorOrDelimiter();
      }
    }

    this.tokens.push(new Token(TokenType.EOF, null, this.line, this.column));
    return { tokens: this.tokens, errors: this.errors };
  }

  // ─── Character Helpers ────────────────────────────────

  _peek() {
    return this.pos < this.source.length ? this.source[this.pos] : '\0';
  }

  _peekNext() {
    return this.pos + 1 < this.source.length ? this.source[this.pos + 1] : '\0';
  }

  _advance() {
    const ch = this.source[this.pos];
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  _isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  _isAlpha(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  _isAlphanumeric(ch) {
    return this._isAlpha(ch) || this._isDigit(ch);
  }

  // ─── Whitespace & Comments ────────────────────────────

  _skipWhitespaceAndComments() {
    while (this.pos < this.source.length) {
      const ch = this._peek();

      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this._advance();
      } else if (ch === '/' && this._peekNext() === '/') {
        // Single-line comment: skip to end of line
        while (this.pos < this.source.length && this._peek() !== '\n') {
          this._advance();
        }
      } else {
        break;
      }
    }
  }

  // ─── Number ───────────────────────────────────────────

  _readNumber() {
    const startLine = this.line;
    const startCol = this.column;
    let value = '';

    while (this.pos < this.source.length && this._isDigit(this._peek())) {
      value += this._advance();
    }

    // Decimal point
    if (this._peek() === '.' && this._isDigit(this._peekNext())) {
      value += this._advance(); // consume '.'
      while (this.pos < this.source.length && this._isDigit(this._peek())) {
        value += this._advance();
      }
    }

    this.tokens.push(new Token(TokenType.NUMBER, parseFloat(value), startLine, startCol));

    // Check for unit suffix (e.g., 10s, 100ms, 50m)
    this._tryReadUnit();
  }

  // ─── Unit ─────────────────────────────────────────────

  _tryReadUnit() {
    const startLine = this.line;
    const startCol = this.column;

    // Check for 'km/h' first
    if (this.pos + 3 < this.source.length) {
      const fourChars = this.source.substring(this.pos, this.pos + 4);
      if (fourChars === 'km/h') {
        for (let i = 0; i < 4; i++) this._advance();
        this.tokens.push(new Token(TokenType.UNIT, 'km/h', startLine, startCol));
        return;
      }
    }

    // Check for 'vpm'
    if (this.pos + 2 < this.source.length) {
      const threeChars = this.source.substring(this.pos, this.pos + 3);
      if (threeChars === 'vpm' && !this._isAlpha(this.source[this.pos + 3] || '\0')) {
        for (let i = 0; i < 3; i++) this._advance();
        this.tokens.push(new Token(TokenType.UNIT, 'vpm', startLine, startCol));
        return;
      }
    }

    // Check for 'ms' (must come before 's')
    if (this.pos + 1 < this.source.length) {
      const twoChars = this.source.substring(this.pos, this.pos + 2);
      if (twoChars === 'ms' && !this._isAlpha(this.source[this.pos + 2] || '\0')) {
        this._advance(); this._advance();
        this.tokens.push(new Token(TokenType.UNIT, 'ms', startLine, startCol));
        return;
      }
    }

    // Check for 's' or 'm'
    const ch = this._peek();
    if ((ch === 's' || ch === 'm') && !this._isAlpha(this._peekNext())) {
      this._advance();
      this.tokens.push(new Token(TokenType.UNIT, ch, startLine, startCol));
    }
  }

  // ─── Identifier / Keyword ────────────────────────────

  _readIdentifierOrKeyword() {
    const startLine = this.line;
    const startCol = this.column;
    let value = '';

    while (this.pos < this.source.length && this._isAlphanumeric(this._peek())) {
      value += this._advance();
    }

    // Check for boolean literals
    if (value === 'true' || value === 'false') {
      this.tokens.push(new Token(TokenType.BOOLEAN, value === 'true', startLine, startCol));
    }
    // Check for keywords
    else if (KEYWORDS.has(value)) {
      this.tokens.push(new Token(TokenType.KEYWORD, value, startLine, startCol));
    }
    // Otherwise it's an identifier
    else {
      this.tokens.push(new Token(TokenType.IDENTIFIER, value, startLine, startCol));
    }
  }

  // ─── String ───────────────────────────────────────────

  _readString() {
    const startLine = this.line;
    const startCol = this.column;
    this._advance(); // consume opening '"'

    let value = '';
    while (this.pos < this.source.length && this._peek() !== '"') {
      if (this._peek() === '\n') {
        this.errors.push({
          message: 'Unterminated string literal',
          line: startLine,
          column: startCol,
        });
        break;
      }
      if (this._peek() === '\\') {
        this._advance(); // consume backslash
        const escaped = this._advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case '"': value += '"'; break;
          case '\\': value += '\\'; break;
          default: value += escaped;
        }
      } else {
        value += this._advance();
      }
    }

    if (this._peek() === '"') {
      this._advance(); // consume closing '"'
    } else {
      this.errors.push({
        message: 'Unterminated string literal',
        line: startLine,
        column: startCol,
      });
    }

    this.tokens.push(new Token(TokenType.STRING, value, startLine, startCol));
  }

  // ─── Operators & Delimiters ───────────────────────────

  _readOperatorOrDelimiter() {
    const startLine = this.line;
    const startCol = this.column;
    const ch = this._advance();

    switch (ch) {
      case '+': this.tokens.push(new Token(TokenType.PLUS, '+', startLine, startCol)); break;
      case '-': this.tokens.push(new Token(TokenType.MINUS, '-', startLine, startCol)); break;
      case '*': this.tokens.push(new Token(TokenType.STAR, '*', startLine, startCol)); break;
      case '/': this.tokens.push(new Token(TokenType.SLASH, '/', startLine, startCol)); break;
      case '(': this.tokens.push(new Token(TokenType.LPAREN, '(', startLine, startCol)); break;
      case ')': this.tokens.push(new Token(TokenType.RPAREN, ')', startLine, startCol)); break;
      case '{': this.tokens.push(new Token(TokenType.LBRACE, '{', startLine, startCol)); break;
      case '}': this.tokens.push(new Token(TokenType.RBRACE, '}', startLine, startCol)); break;
      case ',': this.tokens.push(new Token(TokenType.COMMA, ',', startLine, startCol)); break;
      case ';': this.tokens.push(new Token(TokenType.SEMICOLON, ';', startLine, startCol)); break;
      case ':': this.tokens.push(new Token(TokenType.COLON, ':', startLine, startCol)); break;

      case '=':
        if (this._peek() === '=') {
          this._advance();
          this.tokens.push(new Token(TokenType.EQ, '==', startLine, startCol));
        } else {
          this.tokens.push(new Token(TokenType.EQUALS, '=', startLine, startCol));
        }
        break;

      case '!':
        if (this._peek() === '=') {
          this._advance();
          this.tokens.push(new Token(TokenType.NEQ, '!=', startLine, startCol));
        } else {
          this.errors.push({
            message: `Unexpected character '!'  — did you mean '!='?`,
            line: startLine,
            column: startCol,
          });
        }
        break;

      case '>':
        if (this._peek() === '=') {
          this._advance();
          this.tokens.push(new Token(TokenType.GTE, '>=', startLine, startCol));
        } else {
          this.tokens.push(new Token(TokenType.GT, '>', startLine, startCol));
        }
        break;

      case '<':
        if (this._peek() === '=') {
          this._advance();
          this.tokens.push(new Token(TokenType.LTE, '<=', startLine, startCol));
        } else {
          this.tokens.push(new Token(TokenType.LT, '<', startLine, startCol));
        }
        break;

      default:
        this.errors.push({
          message: `Unexpected character '${ch}'`,
          line: startLine,
          column: startCol,
        });
    }
  }
}
