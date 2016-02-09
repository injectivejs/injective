var Module = require('module');
var join = require('path').join;
var debug = require('debug')('injective');

module.exports = exports = Injective;

function Injective(module, config, cache) {
    if (!(this instanceof Injective)) {
        return new Injective(module, config, cache);
    }

    this._module = module;
    this._config = config || {};
    this._cache = cache || {};
}

Injective.TYPE = '@type';
Injective.REQUIRE = '@require';
Injective.SINGLETON = '@singleton';
Injective.ID = '@id';
Injective.ON_ERROR = '@onError';

Injective.isInstantiable = function(obj) {
    return typeof obj[Injective.TYPE] === 'string';
};

/**
 * Inherit from current injective object with new context
 * @returns {Object} new injective object
 */
Injective.prototype.create = function() {
    debug('Creating new context');
    return new Injective(this._module, this._config, Object.create(this._cache));
};

/**
 * Define object
 * @param {String} id
 * @param {Object} obj
 * @returns {Object} this
 */
Injective.prototype.define = function(id, obj) {
    debug('Defining instance for ' + id);
    this._cache[id] = obj;
    return this;
};

/**
 * Require dependencies
 * @param {String|Array} name(s)
 * @returns {Object} The instance
 */
Injective.prototype.require = function(deps) {
    var self = this;

    if (Array.isArray(deps)) {
        return asyncReduce(deps, function(memo, dep) {
            return self.fromName(dep).then(function(instance) {
                memo.push(instance);
                return memo;
            });
        }, []);
    }

    return this.fromName(deps);
};

/**
 * Get instance by name
 * @param {String} name
 * @returns {Object} The instance
 */
Injective.prototype.fromName = function(name) {
    var self = this;
    var paths = this._resolvePath(name);

    // Bundles
    if (Array.isArray(paths)) {
        return asyncReduce(paths, function(memo, path) {
            return self._load(path).then(function(instance) {
                memo.push(instance);
                return memo;
            });
        }, []);
    }

    return this._load(paths);
};

/**
 * Instantiate the given constructor/ factory function
 * @param {Object} instantiable
 * @param {Object} options
 * @returns {Object} The instance
 */
Injective.prototype.fromInstantiatable = function(instantiable, options) {
    var self = this;
    options = options || {};
    return asyncReduce(instantiable[Injective.REQUIRE] || options.require || [], function(memo, dep) {
        return self.fromName(dep).then(function(instance) {
            memo.push(instance);
            return memo;
        });
    }, []).then(function(deps) {
        var type = instantiable[Injective.TYPE] || options.type;
        var instance;

        switch (type) {
            case 'factory':
                instance = instantiable.apply(instantiable, deps);
                break;
            case 'constructor':
                instance = new(instantiable.bind.apply(instantiable, [null].concat(deps)));
                break;
            default:
                throw new Error('Unknown type: ' + type);
        }

        return instance;
    }).then(function(instance) { // an extra then() here in case instance is a promise
        if (instantiable[Injective.SINGLETON] || options.singleton) {
            self.define(instantiable[Injective.ID] || options.id, instance);
        }

        return instance;
    }).catch(function(err) {
        if (typeof instantiable[Injective.ON_ERROR] === 'function') {
            instantiable[Injective.ON_ERROR](err);
        } else {
            throw err;
        }
    });
};

/**
 * Resolve the given path according to config
 * @param {String} path
 * @returns {String|Array} The resolved path
 */
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

/**
 * Resolve the given path or identifier into instance
 * @param {String} path Path or identifier of the instance
 * @returns {Promise} The resolved instance
 */
Injective.prototype._load = function(path) {
    debug('Loading ' + path + ' from module ' + this._module.id);

    if (path === 'injective') {
        return Promise.resolve(this);
    }

    if (path in this._cache) {
        debug('Pre-defined instance exists, using cache: ' + path);
        return Promise.resolve(this._cache[path]);
    }

    try {
        var filename = Module._resolveFilename(path, this._module);
    } catch (err) {
        return Promise.reject(new Error('Failed to resolve ' + resolvedPath + ' from ' + this._module.id));
    }

    debug('Resolved ' + path + ' -> ' + filename);

    if (filename in this._cache) {
        debug('Singleton instance exists, using cache: ' + filename);
        return Promise.resolve(this._cache[filename]);
    }

    // Make sure it is loaded by node and got injected
    var exports = this._module.require(filename);

    if (Injective.isInstantiable(exports)) {
        debug('Instantiating instance: ' + filename);
        var cachedModule = Module._cache[filename];
        var injective = new Injective(cachedModule, this._config, this._cache);
        return injective.fromInstantiatable(exports, {
            id: cachedModule.id
        });
    }

    debug('Returning raw module: ' + filename);

    return Promise.resolve(exports);
};

/**
 * Reduce an array asynchronously, await on each reduce operation
 * @param {Array} arr Array of value to be reduced
 * @param {Function} reducer Reducer function which transform value into promise
 * @param {Any} initialValue An initial value
 * @returns {Promise} 
 */
function asyncReduce(arr, reducer, initialValue) {
    var p = Promise.resolve(initialValue);

    arr.forEach(function(item) {
        p = p.then(function(result) {
            return reducer(result, item);
        });
    });

    return p;
}