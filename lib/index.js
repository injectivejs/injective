var Module = require('module');
var join = require('path').join;
var debug = require('debug')('injective');

module.exports = exports = Injective;

function Injective(module, config, context) {
    if (!(this instanceof Injective)) {
        return new Injective(module, config, context);
    }

    this._module = module;
    this._config = config || {};
    this._context = context || {};
}

Injective.TYPE = '@type';
Injective.INJECT = '@inject';
Injective.SINGLETON = '@singleton';
Injective.ID = '@id';
Injective.ON_ERROR = '@onError';

Injective.isInstantiable = function(obj) {
    return typeof obj === 'function' && typeof obj[Injective.TYPE] === 'string';
};

/**
 * Create a new runtime context on top of parent’s runtime context (prototype chain) and inherits from parent’s config.
 * @returns {Object} new injective object
 */
Injective.prototype.create = function() {
    debug('Creating new context');
    return new Injective(this._module, this._config, Object.create(this._context));
};

/**
 * Set a module instance into the registry
 * @param {String} id
 * @param {Object} obj
 * @returns {Object} this
 */
Injective.prototype.set = function(id, instance) {
    debug('Defining instance for ' + id);
    this._context[id] = instance;
    return this;
};

/**
 * Get a module from the registry
 * @param {String} module id
 * @returns {Boolean} Whether module is successfully deleted
 */
Injective.prototype.get = function(id) {
    return this._context[id];
};

/**
 * Whether module exists in the registry
 * @param {String} module id
 * @returns {Boolean} Whether module exists
 */
Injective.prototype.has = function(id) {
    return id in this._context;
};

/**
 * Delete a module from the registry
 * @param {String} module id
 * @returns {Boolean} Whether module is successfully deleted
 */
Injective.prototype.delete = function(id) {
    return delete this._context[id];
};

/**
 * Require dependencies
 * @param {String|Array} name(s)
 * @returns {Promise} Promise that resolves to instance(s)
 */
Injective.prototype.import = function(deps) {
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
 * @returns {Promise} Promise that resolves to instance
 */
Injective.prototype.fromName = function(name) {
    var path = this._resolvePath(name);

    // Bundles
    if (Array.isArray(path)) {
        return this.import(path);
    }

    debug('Loading ' + path + ' from module ' + this._module.id);

    if (path === 'injective') {
        return Promise.resolve(this);
    }

    if (path in this._context) {
        debug('Pre-defined instance exists, using cache: ' + path);
        return Promise.resolve(this._context[path]);
    }

    try {
        var filename = Module._resolveFilename(path, this._module);
    } catch (err) {
        return Promise.reject(new Error('Failed to resolve ' + path + ' from ' + this._module.id));
    }

    debug('Resolved ' + path + ' -> ' + filename);

    if (filename in this._context) {
        debug('Singleton instance exists, using cache: ' + filename);
        return Promise.resolve(this._context[filename]);
    }

    // Make sure it is loaded by node
    var exports = this._module.require(filename);

    if (Injective.isInstantiable(exports)) {
        debug('Instantiating instance: ' + filename);
        var cachedModule = Module._cache[filename];
        var injective = new Injective(cachedModule, this._config, this._context);
        return injective.fromInstantiatable(exports, {
            id: cachedModule.id
        });
    }

    debug('Returning raw module: ' + filename);

    return Promise.resolve(exports);
};

/**
 * Instantiate the given constructor/ factory function
 * @param {Object} instantiable
 * @param {Object} options
 * @returns {Promise} Promise that resolves to instance
 */
Injective.prototype.fromInstantiatable = function(instantiable, options) {
    var self = this;
    options = options || {};
    return this.import(instantiable[Injective.INJECT] || options.inject || []).then(function(deps) {
        var type = instantiable[Injective.TYPE] || options.type;

        switch (type) {
            case 'factory':
                return instantiable.apply(instantiable, deps);
            case 'constructor':
                return new(instantiable.bind.apply(instantiable, [null].concat(deps)));
            default:
                throw new Error('Unknown type: ' + type);
        }
    }).then(function(instance) { // an extra then() here in case instance is a promise
        if (instantiable[Injective.SINGLETON] || options.singleton) {
            self.set(instantiable[Injective.ID] || options.id, instance);
        }

        return instance;
    }).catch(function(err) {
        if (typeof instantiable[Injective.ON_ERROR] === 'function') {
            return instantiable[Injective.ON_ERROR](err);
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