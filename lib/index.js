var Module = require('module');
var join = require('path').join;
var resolve = require('path').resolve;
var debug = require('debug')('injective');
var util = require('util');

module.exports = exports = Injective;

function Injective(module, config, registry, context, parent) {
    if (!(this instanceof Injective)) {
        return new Injective(module, config, registry, context, parent);
    }

    this._module = module;
    this._config = config || Object.create(null);
    this._registry = registry || Object.create(null);
    this._context = context || Object.create(null);
    this._parent = parent;
}

Injective.TYPE = '@type';
Injective.INJECT = '@inject';
Injective.SINGLETON = '@singleton';
Injective.ID = '@id';
Injective.ON_ERROR = '@onError';

/**
 * Test whether an object can be instantiate
 * @param {Object} Object to be tested
 * @returns {Boolean}
 */
Injective.isInstantiable = function(obj) {
    return typeof obj === 'function' && typeof obj[Injective.TYPE] === 'string';
};

/**
 * Test whether an object need to be injected
 * @param {Object} Object to be tested
 * @returns {Boolean}
 */
Injective.isInjectable = function(obj) {
    return typeof obj !== 'undefined' && Array.isArray(obj[Injective.INJECT]);
};

/**
 * Create a new runtime context on top of parent’s runtime context (using prototype chain) and inherits from parent’s config.
 * @param {Object} config to override
 * @param {Object} context to override
 * @returns {Object} new injective object
 */
Injective.prototype.create = function() {
    debug('Creating new context');
    return new Injective(this._module, this._config, Object.create(this._registry), Object.create(this._context), this);
}

/**
 * Define an instance into runtime context
 * @param {String} id
 * @param {Object} obj
 * @returns {Object} this
 */
Injective.prototype.set = function(id, instance) {
    debug('Defining instance for %s', id);
    this._context[id] = instance;
    return this;
};

/**
 * Get an instance from the runtime context
 * @param {String} module id
 * @returns {Object} The module
 */
Injective.prototype.get = function(id) {
    return this._context[id];
};

/**
 * Whether an instance is defined in the runtime context
 * @param {String} module id
 * @returns {Boolean}
 */
Injective.prototype.has = function(id) {
    return id in this._context;
};

/**
 * Delete an instance from the runtime context
 * @param {String} module id
 * @returns {Boolean} Whether module is successfully deleted
 */
Injective.prototype.delete = function(id) {
    return delete this._context[id];
};

/**
 * Dynamically register a module. You may separate the annotations into a ``meta`` object.
 * @param {String} id
 * @param {Object} obj
 * @returns {Object} this
 */
Injective.prototype.register = function(id, obj, meta) {
    debug('Registering instance for %s', id);
    this._registry[id] = {
        obj: obj,
        meta: meta
    };
    return this;
};

/**
 * De-register a module
 * @param {String} id
 * @returns {Boolean} Whether module creator is successfully deleted
 */
Injective.prototype.deregister = function(id) {
    debug('De-registering instance for %s', id);
    return delete this._registry[id];
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
    debug('Loading %s from module %s', name, this._module.id);

    if (name === 'injective') {
        return Promise.resolve(this);
    }

    if (name in this._context) {
        debug('Pre-defined instance exists, using cache: %s', name);
        return Promise.resolve(this._context[name]);
    }

    if (name in this._registry) {
        debug('Pre-registered instance exists, creating: %s', name);
        return this.fromObject(this._registry[name].obj, this._registry[name].meta);
    }

    try {
        var filename = this.resolve(name);
    } catch (err) {
        return Promise.reject(new Error(util.format('Failed to resolve %s from %s: %s', name, this._module.id, err.message)));
    }

    debug('Resolved %s -> %s', name, filename);

    if (Array.isArray(filename)) {
        debug('Loading bundles');
        return this.import(filename);
    }

    if (filename in this._context) {
        debug('Singleton instance exists, using cache: %s', filename);
        return Promise.resolve(this._context[filename]);
    }

    try {
        // Using native node require
        var exports = this._module.require(filename);
    } catch (err) {
        return Promise.reject(new Error(util.format('Failed to require %s from %s: %s', name, this._module.id, err.message)));
    }

    if (Injective.isInstantiable(exports) || Injective.isInjectable(exports)) {
        debug('Instantiating instance: %s', filename);
        var cachedModule = Module._cache[filename];
        var injective = new Injective(cachedModule, this._config, this._registry, this._context, this);
        return injective.fromObject(exports, {
            id: cachedModule.id
        });
    }

    debug('Returning raw module: %s', filename);

    return Promise.resolve(exports);
};

/**
 * Instantiate the given constructor/ factory function
 * @param {Object} obj
 * @param {Object} options
 * @returns {Promise} Promise that resolves to instance
 */
Injective.prototype.fromObject = function(obj, options) {
    var self = this;
    options = options || {};
    return this.import(Injective.isInjectable(obj) ? obj[Injective.INJECT] : (options.inject || [])).then(function(deps) {
        if (Injective.isInstantiable(obj) || (typeof obj === 'function' && typeof options.type === 'string')) {
            var type = obj[Injective.TYPE] || options.type;

            switch (type) {
                case 'factory':
                    return obj.apply(obj, deps);
                case 'constructor':
                    return new(obj.bind.apply(obj, [null].concat(deps)));
                default:
                    throw new Error('Unknown type: ' + type);
            }
        }

        return obj;
    }).then(function(instance) { // an extra then() here in case instance is a promise
        if (obj[Injective.SINGLETON] || options.singleton) {
            self.set(obj[Injective.ID] || options.id, instance);
        }

        return instance;
    }).catch(function(err) {
        if (typeof obj[Injective.ON_ERROR] === 'function') {
            return obj[Injective.ON_ERROR](err);
        } else {
            throw err;
        }
    });
};

/**
 * Resolve the given path to absolute filename according to config, throw if cannot be resolved
 * @param {String} path
 * @returns {String|Array} The resolved absolute filename
 */
Injective.prototype.resolve = function(path) {
    // Relative to current module
    if (isRelativePath(path)) {
        return Module._resolveFilename(path, this._module);
    }

    // Bundles
    if ('bundles' in this._config && path in this._config.bundles) {
        return this._config.bundles[path].map(this.resolve.bind(this));
    }

    // Paths
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

    // Absolute path or node module
    return Module._resolveFilename(path, this._module);
};

/**
 * Reduce an array asynchronously, await on each reduce operation
 * @param {Array} arr Array of value to be reduced
 * @param {Function} reducer Reducer function which transform value into promise
 * @param {Any} initialValue An initial value
 * @returns {Promise} The reduced result
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

function isRelativePath(path) {
    return /^\./.test(path) || /^\.\./.test(path);
}
