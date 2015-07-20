var Module = require('module');
var join = require('path').join;
var debug = require('debug')('injective');

module.exports = exports = Injective;

var typeProp = 'type';
var depsProp = 'deps';
var singletonProp = 'singleton';
var injectFunc = 'inject';
var injectedProp = 'injected';

function Injective(config, cache) {
    this.config = config;
    this._cache = typeof cache !== 'undefined' ? Object.create(cache) : {};
}

Injective.isInjectable = function(module) {
    return typeProp in module || typeof module[injectFunc] === 'function';
};

Injective.install = function(config) {
    var injective = new Injective(config);
    Module.prototype._injective = injective;

    Module._extensions['.js'] = function(func, module, filename) {
        func(module, filename);
        if (Injective.isInjectable(module)) {
            injective._injectOrCreateInstance(module, filename);
        }
    }.bind(Module, require.extensions['.js']);
    return injective;
};

Injective.prototype.create = function() {
    debug('Creating new context');
    return new Injective(this.config, this._cache);
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
    deps = Array.isArray(deps) ? deps : [deps];
    var resolvedDeps = deps.map(function(dep) {
        return self._load(dep, module);
    });

    if (typeof callback === 'function') {
        return callback.apply(null, resolvedDeps);
    }
};

// upgrade path if necessary
Injective.prototype._resolvePath = function(path) {
    if (path in this.config.paths) {
        path = this.config.paths[path];
    }

    if (path[0] === '/') {
        path = join(process.cwd(), path);
    }

    return path;
};

/**
 * Inject dependency and/or create (singleton) instance
 */
Injective.prototype._injectOrCreateInstance = function(module, filename) {
    var self = this;

    if (typeof module[injectedProp] === 'undefined' && typeof module[injectFunc] === 'function') {
        debug('Injecting dependency into ' + filename);
        var injectDeps = depsProp in module[injectFunc] ? module[injectFunc][depsProp].map(function(dep) {
            return self._load(dep, module);
        }) : [];
        module[injectFunc].apply(module, injectDeps);
        module[injectedProp] = true;
    }

    if (typeof module[typeProp] === 'undefined') {
        return module.exports;
    }

    debug('Creating new instance for ' + filename);

    var deps = depsProp in module ? module[depsProp].map(function(dep) {
        return self._load(dep, module);
    }) : [];

    var instance;
    var type = module[typeProp];

    switch (type) {
        case 'factory':
            instance = module.exports.apply(module.exports, deps);
            break;
        case 'service':
            instance = new(Function.prototype.bind.apply(module.exports, [null].concat(deps)));
            break;
        default:
            throw new Error('Unknown type ' + type + ' defined in ' + filename);
    }

    if (module[singletonProp]) {
        this.define(filename, instance);
    }

    return instance;
};

/**
 * Turn require id and its dependencies into instance
 * path path of dep
 * module the module that requiring the dep
 */
Injective.prototype._load = function(path, module) {
    debug('Loading ' + path + ' from module ' + module.id);

    // user-defined object
    if (path in this._cache) {
        debug('Pre-defined instance exists, using cache: ' + path);
        return this._cache[path];
    }

    var filename = Module._resolveFilename(this._resolvePath(path), module);

    debug('Resolved ' + path + ' -> ' + filename);

    var mod = module.require(filename);

    // singleton
    if (filename in this._cache) {
        debug('Instance exists, using cache: ' + filename);
        return this._cache[filename];
    }

    var cachedModule = Module._cache[filename];

    // non-singleton
    if (Injective.isInjectable(cachedModule)) {
        return this._injectOrCreateInstance(cachedModule, filename);
    }

    debug('Rely on native require() to load: ' + filename);

    return mod;
};