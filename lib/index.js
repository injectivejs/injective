var Module = require('module');
var join = require('path').join;
var debug = require('debug')('injective');

module.exports = exports = Injective;

function Injective(config, cache) {
    this._config = config || {};
    this._cache = cache || {};

    this.define('injective', this);
}

Injective.TYPE = '@type';
Injective.REQUIRE = '@require';
Injective.SINGLETON = '@singleton';
Injective.INJECT = '@inject';

Injective.isInjectable = function(module) {
    return typeof module.exports[Injective.INJECT] === 'function';
};

Injective.isInstantiable = function(module) {
    return typeof module.exports[Injective.TYPE] === 'string';
};

Injective.install = function(config, extensions) {
    var injective = new Injective(config);
    extensions = extensions || ['.js'];
    extensions.forEach(function(extension) {
        Module._extensions[extension] = function(func, module, filename) {
            func(module, filename);

            if (Injective.isInjectable(module)) {
                injective._inject(module, filename);
            }
        }.bind(Module, Module._extensions[extension]);
    });
    return injective;
};

Injective.prototype.create = function() {
    debug('Creating new context');
    return new Injective(this._config, Object.create(this._cache));
};

Injective.prototype.define = function(id, obj) {
    debug('Defining instance for ' + id);
    this._cache[id] = obj;
    return this;
};

/**
 * (Module, Array)
 * (Module, String)
 */
Injective.prototype.require = function(module, deps) {
    var self = this;

    if (Array.isArray(deps)) {
        return deps.map(function(dep) {
            return self._resolveDep(module, self._resolvePath(dep));
        });
    }

    return this._resolveDep(module, this._resolvePath(deps));
};

Injective.prototype.requireNative = function(module, paths) {
    var self = this;

    if (Array.isArray(paths)) {
        return paths.map(function(path) {
            return module.require(self._resolvePath(path));
        });
    }

    return module.require(this._resolvePath(paths));
};

// upgrade path if necessary
Injective.prototype._resolvePath = function(path) {
    if ('bundles' in this._config && path in this._config.bundles) {
        return this._config.bundles[path].map(this._resolvePath.bind(this));
    }

    if ('paths' in this._config) {
        var syms = path.split('/');

        for (var i = syms.length; i > 0; i--) {
            var parentPath = syms.slice(0, i).join('/');

            if (parentPath in this._config.paths) {
                syms.splice(0, i, this._config.paths[parentPath]);
                path = syms.join('/');
                break;
            }
        }
    }

    if (path.charAt(0) === '/') {
        path = join('basePath' in this._config ? this._config.basePath : process.cwd(), path);
    }

    return path;
};

Injective.prototype._inject = function(module, filename) {
    var self = this;
    debug('Injecting dependency into ' + filename);
    var resolvedDeps = Injective.REQUIRE in module.exports[Injective.INJECT] ? module.exports[Injective.INJECT][Injective.REQUIRE].map(function(dep) {
        return self._resolveDep(module, self._resolvePath(dep));
    }) : [];
    return module.exports[Injective.INJECT].apply(null, resolvedDeps);
};

Injective.prototype._resolveDep = function(module, paths) {
    var self = this;

    // Bundles
    if (Array.isArray(paths)) {
        return paths.map(function(path) {
            return self._load(module, path);
        });
    }

    return this._load(module, paths);
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

    var resolvedPath = this._resolvePath(path);

    try {
        var filename = Module._resolveFilename(resolvedPath, module);
    } catch (err) {
        console.error('Failed to resolve ' + resolvedPath + ' from ' + module.id);
        throw err;
    }

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

/**
 * Inject dependency and/or create (singleton) instance
 */
Injective.prototype._instantiate = function(module, filename) {
    debug('Creating new instance for ' + filename);
    var self = this;
    var resolvedDeps = Injective.REQUIRE in module.exports ? module.exports[Injective.REQUIRE].map(function(dep) {
        return self._resolveDep(module, self._resolvePath(dep));
    }) : [];
    var type = module.exports[Injective.TYPE];
    var instance;

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

    if (module.exports[Injective.SINGLETON]) {
        this.define(filename, instance);
    }

    return instance;
};