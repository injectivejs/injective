var Module = require('module');
var join = require('path').join;
var debug = require('debug')('injective');

module.exports = exports = Injective;

var typeProp = 'type';
var depsProp = 'deps';

function Injective(config) {
    this._cache = {};
    this.config = config;
}

Injective.install = function(config) {
    var injective = new Injective(config);
    Module.prototype._injective = injective;

    Module._extensions['.js'] = function(func, module, filename) {
        func(module, filename);
        injective._createInstance(module, filename);
    }.bind(Module, require.extensions['.js']);
    return injective;
}

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
    return callback ? callback.apply(null, resolvedDeps) : undefined;
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

Injective.prototype._createInstance = function(module, filename) {
    if (!(typeProp in module)) {
        return module.exports;
    }

    debug('Creating instance for ' + filename);

    var self = this;
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
        case 'inject':
            module.inject.apply(module, deps);
            break;
        default:
            throw new Error('Unknown type ' + type + ' defined in ' + filename);
    }

    this._cache[filename] = instance;

    return instance;
}

/**
 * Turn require id and its dependencies into instance
 * path path of dep
 * module the module that requiring the dep
 */
Injective.prototype._load = function(path, module) {
    debug('Loading ' + path + ' from module ' + module.id);
    var filename = Module._resolveFilename(this._resolvePath(path), module);
    debug('Resolved filename ' + filename);

    var mod = module.require(filename);

    if (filename in this._cache) {
        debug('Instance exist, using cache: ' + filename)
        return this._cache[filename];
    }

    debug('Rely on native require() to load: ' + filename);

    return mod;
};