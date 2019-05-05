const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const chalk = require('chalk');

const transform = require('./transform');

const log = {
  _log(atoms) {
    return console.log(atoms.map(([method, ...args]) => chalk[method](...args)).join(' '));
  },

  main(a, ...args) {
    return this._log([['bgGreen', a], ['green', ...args]]);
  },

  debug(...args) {
    if (!process.env.DEBUG) {
      return;
    }
    return this._log([['grey', ...args]]);
  },

  info(a, ...args) {
    return this._log([['bgBlue', a], ['blue', ...args]]);
  },

  error(a, ...args) {
    return this._log([['bgRed', a], ['red', ...args]]);
  }
};

function moveFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    mkdirp.sync(dir);
  }
  fs.renameSync(src, dest);
}

// return an absolute path
function expandAlias(filepath, importPath, aliases) {
  const entries = Object.entries(aliases);
  for (let i = 0; i < entries.length; ++i) {
    const [alias, fullpath] = entries[i];
    if (importPath.startsWith(alias)) {
      const expanded = fullpath + importPath.slice(alias.length);
      log.debug('EXPAND', `${importPath} -> ${expanded}`);
      return expanded;
    }
  }
  const expanded = path.resolve(path.dirname(filepath), importPath);
  log.debug('EXPAND', `${importPath} -> ${expanded}`);
  return expanded;
}

// return a relative path
function foldWithAlias(filepath, destPath, aliases) {
  const entries = Object.entries(aliases);
  for (let i = 0; i < entries.length; ++i) {
    const [alias, fullpath] = entries[i];
    if (destPath.startsWith(fullpath)) {
      const folded = alias + destPath.slice(fullpath.length);
      log.debug('FOLD', `${destPath} -> ${folded}`);
      return folded;
    }
  }
  let newPath = path.relative(path.dirname(filepath), destPath);
  // Todo: remove './' hardcode
  if (!newPath.startsWith('.')) {
    newPath = './' + path.normalize(newPath);
  }
  return newPath;
}

function isPathEqual(importPath, realPath) {
  if (importPath === realPath) {
    return true;
  }
  // ignore path with extension
  if (path.parse(importPath).ext) {
    return false;
  }
  // Todo: hardcode `.js` here
  if (importPath + '.js' === realPath) {
    return true;
  }
  return path.join(importPath, 'index.js') === realPath;
}

function isCoreImport(importPath, aliases) {
  const aliasArr = Object.keys(aliases);
  for (let i = 0; i < aliasArr.length; ++i) {
    if (importPath.startsWith(aliasArr[i])) {
      return false;
    }
  }
  return !importPath.startsWith('.');
}

function prefixImportPath(content, filepath, destImportPath, aliases) {
  return transform(content, source => {
    if (isCoreImport(source, aliases)) {
      return source;
    }
    const expanded = expandAlias(filepath, source, aliases);
    const newPath = foldWithAlias(destImportPath, expanded, aliases)
    log.info('IMPORT', filepath, `${source} -> ${newPath}`);
    return newPath;
  });
}

function fixImportPath(content, filepath, srcImportPath, destImportPath, aliases) {
  let changed = false;
  const ret = transform(content, source => {
    if (isCoreImport(source, aliases)) {
      return source;
    }
    const currentImportPath = expandAlias(filepath, source, aliases);
    if (isPathEqual(currentImportPath, srcImportPath)) {
      const newPath = foldWithAlias(filepath, destImportPath, aliases);
      log.info('IMPORT', filepath, `${source} -> ${newPath}`);
      changed = true;
      return newPath;
    }
    return source;
  });
  return changed && ret;
}

function walk(dir, callback) {
  if (typeof callback !== 'function') {
    return;
  }
  const sub = fs.readdirSync(dir);
  sub.forEach(file => {
    const f = path.join(dir, file);
    const stat = fs.statSync(f);
    if (stat.isFile()) {
      if (f.endsWith('.js')) {
        callback(f);
      }
    } else if (stat.isDirectory()) {
      walk(f, callback);
    }
  });
}

function mvJsFile(src, dest, { root = process.cwd(), aliases = {} }) {
  log.main('MV', `${src} -> ${dest}`);
  const content = fs.readFileSync(src, 'utf-8');
  const transformed = prefixImportPath(content, src, dest, aliases);
  fs.writeFileSync(src, transformed);
  moveFile(src, dest);
  walk(root, (filepath) => {
    if (filepath === dest) {
      return;
    }
    const content = fs.readFileSync(filepath, 'utf-8');
    log.debug('INTERPRETE', filepath);
    const newContent = fixImportPath(content, filepath, src, dest, aliases);
    if (newContent) {
      fs.writeFileSync(filepath, newContent);
    }
  });
}

module.exports = mvJsFile;
