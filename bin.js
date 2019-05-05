#!/usr/bin/env node
const path = require('path');
const program = require('commander');

const mvJsFile = require('./index.js');

const absPath = filepath => path.isAbsolute(filepath) ? filepath : path.resolve(filepath);

program.version('0.1.0')
.usage('<src dest ...>')
.option('--alias <items>', 'alias, e.g @pages=src/pages', (alias, aliases) => {
  const [key, value] = alias.split('=');
  if (!key || !value) {
    throw new Error(`invalid alias: ${alias}`)
  }
  aliases[key] = absPath(value);
  return aliases;
}, {})
.option('--root [value]', 'project root, default `pwd`', absPath)
.parse(process.argv)

function readSrcDest(program) {
  const [src, dest] = program.args;
  if (!src || !dest) {
    program.outputHelp();
    process.exit(1);
  }
  return [absPath(src), absPath(dest)];
}

const [src, dest] = readSrcDest(program);
const root = program.root || process.cwd();
const aliases = program.alias;

mvJsFile(src, dest, {root, aliases});
