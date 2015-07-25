var Module = require('module');
var join = require('path').join;
var debug = require('debug')('injective');

module.exports = exports = Injective;

var injectiveProp = typeof Symbol === 'undefined' ? '@@injective' : Symbol.for('injective');
var typeProp = 'type';
var depsProp = 'deps';
var singletonProp = 'singleton';
var injectProp = 'inject';
var injectDepsProp = 'injectDeps';

function Injective(config, cache) {
    this._config = config || {};
    this._cache = cache || {};
}

Injective.injective = null;

Injective.isInjective = function(module) {
    return injectiveProp in module.exports;
};

Injective.isInjectable = function(module) {
    return Injective.isInjective(module) && injectProp in module.exports[injectiveProp] && typeof module.exports[injectiveProp][injectProp] === 'function';
};

Injective.isInstantiable = function(module) {
    return Injective.isInjective(module) && typeProp in module.exports[injectiveProp];
};

Injective.install = function(config) {
    var extension = '.js';
    Module._extensions[extension] = function(func, module, filename) {
        module.injective = Injective.injective;
        func(module, filename);
        if (Injective.isInjectable(module)) {
            Injective.injective._inject(module, filename);
        }
    }.bind(Module, require.extensions[extension]);
    Injective.injective = new Injective(config);
    return Injective.injective;
};

Injective.prototype.create = function() {
    debug('Creating new context');
    Injective.injective = new Injective(this._config, Object.create(this._cache));
    return Injective.injective;
};

Injective.prototype.define = function(id, obj) {
    debug('Defining instance for ' + id);
    this._cache[id] = obj;
};

/**
 * (Array)
 * (String)
 * (Array, Function)
 * (String, Function)
 */
Injective.prototype.require = function(module, deps, callback) {
    var self = this;
    Injective.injective = this;
    deps = Array.isArray(deps) ? deps : [deps];
    var resolvedDeps = this._resolveDeps(module, deps);

    if (typeof callback === 'function') {
        return callback.apply(null, resolvedDeps);
    }
};

/**
 * Turn require id and its dependencies into instance
 * path path of dep
 * module the module that requiring the dep
 */
Injective.prototype._load = function(module, path) {
    debug('Loading ' + path + ' from module ' + module.id);

    // user-defined object
    if (path in this._cache) {
        debug('Pre-defined instance exists, using cache: ' + path);
        return this._cache[path];
    }

    var filename = Module._resolveFilename(this._resolvePath(path), module);

    debug('Resolved ' + path + ' -> ' + filename);

    // singleton
    if (filename in this._cache) {
        debug('Instance exists, using cache: ' + filename);
        return this._cache[filename];
    }

    // Make sure it is loaded by node and got injected
    var mod = module.require(filename);
    var cachedModule = Module._cache[filename];

    // non-singleton
    if (Injective.isInstantiable(cachedModule)) {
        return this._instantiate(cachedModule, filename);
    }

    debug('Rely on native require() to load: ' + filename);

    return mod;
};

// upgrade path if necessary
Injective.prototype._resolvePath = function(path) {
    if ('bundles' in this._config && path in this._config.bundles) {
        path = this._config.bundles[path];
    }

    if ('paths' in this._config && path in this._config.paths) {
        path = this._config.paths[path];
    }

    if (path[0] === '/') {
        path = join(process.cwd(), path);
    }

    return path;
};

Injective.prototype._resolveDeps = function(module, deps) {
    var self = this;
    return deps.map(function(dep) {
        var resolvedPath = self._resolvePath(dep);

        // Bundles
        if (Array.isArray(resolvedPath)) {
            return resolvedPath.forEach(function(dep) {
                self._load(module, dep);
            });
        }

        return self._load(module, dep);
    });
};

Injective.prototype._inject = function(module, filename) {
    var self = this;
    debug('Injecting dependency into ' + filename);
    var injectiveCfg = module.exports[injectiveProp];
    var resolvedDeps = injectDepsProp in injectiveCfg ? this._resolveDeps(module, injectiveCfg[injectDepsProp]) : [];
    injectiveCfg[injectProp].apply(null, resolvedDeps);
    return module.exports;
};

/**
 * Inject dependency and/or create (singleton) instance
 */
Injective.prototype._instantiate = function(module, filename) {
    debug('Creating new instance for ' + filename);
    var self = this;
    var injectiveCfg = module.exports[injectiveProp];
    var resolvedDeps = depsProp in injectiveCfg ? this._resolveDeps(module, injectiveCfg[depsProp]) : [];
    var instance;
    var type = injectiveCfg[typeProp];

    switch (type) {
        case 'factory':
            instance = module.exports.apply(module.exports, resolvedDeps);
            break;
        case 'constructor':
            instance = new(Function.prototype.bind.apply(module.exports, [null].concat(resolvedDeps)));
            break;
        default:
            throw new Error('Unknown type ' + type + ' defined in ' + filename);
    }

    if (injectiveCfg[singletonProp]) {
        this.define(filename, instance);
    }

    return instance;
};