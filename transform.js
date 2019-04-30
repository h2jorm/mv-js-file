class Token {
  constructor(type, value) {
    this.type = type;
    this.value = value;
  }
}

Token.EOF = Symbol('eof');
Token.IMPORT = Symbol('import');
Token.FROM = Symbol('from');
Token.SPACE = Symbol('space');
Token.CRLF = Symbol('crlf');
Token.QUOTE = Symbol('quote');
Token.DQUOTE = Symbol('dquote');
Token.OPAQUE = Symbol('opaque');

const isAlpha = c => {
  if (!c) {
    return false;
  }
  const code = c.charCodeAt(0);
  return (code >= 63 && code <= 90) || (code >= 95 && code <= 121);
}
const isSpace = c => c === ' ';
const isCRLF = c => c === '\n';
const isSingleQuote = a => a === '\'';
const isDoubleQuote = a => a === '"';

const RESERVED_KEYWORDS = {
  import: new Token(Token.IMPORT, 'import'),
  from: new Token(Token.FROM, 'from'),
};

class ImportState {
  constructor() {
    this.import = false;
    this.from = false;
    this.quote = false;
    this.dquote = false;
    this.importPath = '';
  }

  setImport() {
    this.import = true;
  }

  setFrom() {
    this.from = true;
  }

  setQuote() {
    if (this.import && this.from) {
      this.quote = Number(this.quote) + 1;
    }
  }

  setDQuote() {
    if (this.import && this.from) {
      this.dquote = Number(this.dquote) + 1;
    }
  }

  setImportPath(path) {
    if (this.import && this.from && (this.quote || this.dquote)) {
      return this.importPath += path;
    }
  }

  reset() {
    this.import = this.from = this.quote = this.dquote = false;
    this.importPath = '';
  }

  get ready() {
    return this.import && this.from && (this.quote === 2 || this.dquote === 2);
  }
}

class Lexer {
  constructor(text) {
    this.text = text;
    this.pos = 0;
    this.currentChar = this.text[this.pos];
  }

  advance() {
    if (++this.pos >= this.text.length) {
      this.currentChar = null;
    } else {
      this.currentChar = this.text[this.pos];
    }
  }

  peek() {
    const pos = this.pos + 1;
    if (pos >= this.text.length) {
      return null;
    }
    return this.text[pos];
  }

  _id() {
    let id = '';
    while (this.currentChar && isAlpha(this.currentChar)) {
      id += this.currentChar;
      this.advance();
    }
    return RESERVED_KEYWORDS.hasOwnProperty(id) ? RESERVED_KEYWORDS[id] : new Token(Token.OPAQUE, id);
  }

  _nextToken() {
    while (this.currentChar !== null) {
      if (isSpace(this.currentChar)) {
        this.advance();
        return new Token(Token.SPACE, ' ');
      }

      if (isCRLF(this.currentChar)) {
        this.advance();
        return new Token(Token.CRLF, '\n');
      }

      if (isSingleQuote(this.currentChar)) {
        this.advance();
        return new Token(Token.QUOTE, '\'');
      }

      if (isDoubleQuote(this.currentChar)) {
        this.advance();
        return new Token(Token.DQUOTE, '"');
      }

      if (isAlpha(this.currentChar)) {
        return this._id();
      }

      const token = new Token(Token.OPAQUE, this.currentChar);
      this.advance();
      return token;
    }
    return new Token(Token.EOF, null);
  }

  nextToken() {
    return this._nextToken();
  }
}


function transform(content, callback) {
  let ret = '';
  let token = null;
  const importState = new ImportState();
  const lexer = new Lexer(content);

  while (true) {
    token = lexer.nextToken();
    if (token.type === Token.EOF) {
      return ret;
    }
    if (token.type === Token.OPAQUE && importState.setImportPath(token.value)) {
      continue;
    }
    switch (token.type) {
      case Token.IMPORT:
        importState.setImport();
        break;

      case Token.FROM:
        importState.setFrom();
        break;

      case Token.QUOTE:
        importState.setQuote();
        if (importState.ready) {
          ret += callback(importState.importPath);
          importState.reset();
        }
        break;

      case Token.DQUOTE:
        importState.setDQuote();
        if (importState.ready) {
          ret += callback(importState.importPath);
          importState.reset();
        }
        break;
      
      case Token.OPAQUE:
        break;

      case Token.SPACE:
        break;

      case Token.CRLF:
        break;

      default:
        throw new Error(`invalid token type ${token.type}`);
    }
    ret += token.value;
  }
}

module.exports = transform;
