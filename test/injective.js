var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var Injective = require('../lib');
var config = require('./assets/injective');
var module = require('./assets/index');
chai.use(chaiAsPromised);
var expect = chai.expect;

describe('Injective', function() {
    beforeEach(function() {
        this.injective = new Injective(module, config);
    });

    describe('isInstantiable()', function() {
        it('returns false if module is non-instantiable', function() {
            expect(Injective.isInstantiable(function() {})).to.equal(false);
        });

        it('returns false if module is not a function', function() {
            expect(Injective.isInstantiable({})).to.equal(false);
        });

        it('returns true if module is instantiable', function() {
            var instantiable = function() {};
            instantiable['@type'] = 'factory';
            expect(Injective.isInstantiable(instantiable)).to.equal(true);
        });
    });

    describe('isInjectable()', function() {
        it('returns false if module is non-injectable', function() {
            expect(Injective.isInjectable({})).to.equal(false);
        });

        it('returns true if module is injectable', function() {
            expect(Injective.isInjectable({
                '@inject': []
            })).to.equal(true);
        });
    });

    describe('create()', function() {
        it('new context inherits instances from parent context', function() {
            var instance1 = {};
            var instance2 = {};
            this.injective.set('instance1', instance1);
            var injective_ = this.injective.create();
            injective_.set('instance2', instance2);
            return Promise.all([
                expect(injective_.import('instance1')).to.eventually.equal(instance1),
                expect(injective_.import('instance2')).to.eventually.equal(instance2),
                expect(this.injective.import('instance2')).to.be.rejected
            ]);
        });

        it('new context inherits config from parent context', function() {
            var injective_ = this.injective.create();
            return expect(injective_.import('my_util')).not.to.eventually.equal(undefined);
        });
    });

    describe('set() and get()', function() {
        it('Setting a module can be get by both get() and import()', function() {
            var instance = {};
            this.injective.set('instance', instance);
            expect(this.injective.get('instance')).to.equal(instance);
            return expect(this.injective.import('instance')).to.eventually.equal(instance);
        });

        it('defined instance is always singleton', function() {
            var self = this;
            var instance = {};
            this.injective.set('instance', instance);
            return expect(this.injective.import('instance')).to.eventually.equal(instance).then(function() {
                return expect(self.injective.import('instance')).to.eventually.equal(instance);
            });
        });
    });

    describe('has()', function() {
        it('whether a module is defined in the runtime context', function() {
            var instance = {};
            this.injective.set('instance', instance);
            expect(this.injective.has('instance')).to.equal(true);
            expect(this.injective.has('not_exist')).to.equal(false);
        });
    });

    describe('delete()', function() {
        it('delete module from runtime context', function() {
            var instance = {};
            this.injective.set('instance', instance);
            this.injective.delete('instance');
            expect(this.injective.has('instance')).to.equal(false);
        });
    });

    describe('import()', function() {
        describe('resolve dependencies', function() {
            it('using bundles defined in config', function() {
                return expect(this.injective.import('group_a')).to.eventually.have.length(2);
            });

            it('an array of dependency', function() {
                return expect(this.injective.import(['my_util', 'another_lib'])).to.eventually.have.length(2);
            });

            it('using paths defined in config', function() {
                return expect(this.injective.import('my_util')).not.to.eventually.equal(undefined);
            });

            it('replace by paths defined in config', function() {
                return expect(this.injective.import('my_util/index')).not.to.eventually.equal(undefined);
            });

            it('using relative path', function() {
                return expect(this.injective.import('./lib/factory')).not.to.eventually.equal(undefined);
            });

            // This test case assume the current directory is the project directory
            it('using relative path in config will get resolved relative to current directory', function() {
                return expect(this.injective.import('factory')).not.to.eventually.equal(undefined);
            });

            it('fallback to native require if nothing match', function() {
                return expect(this.injective.import('nice_util')).not.to.eventually.equal(undefined);
            });

            it('using the special "injective" dependency will return the injective instance in the current context', function() {
                return expect(this.injective.import('./lib/injective')).not.to.eventually.equal(undefined);
            });
        });

        describe('create instance', function() {
            it('by a factory function', function() {
                return this.injective.import(['./lib/factory', './lib/factory']).then(function(instances) {
                    var instance = instances[0];
                    var instance1 = instances[1];
                    expect(instance1).not.to.equal(instance);
                    expect(instance()).to.equal(1);
                    expect(instance()).to.equal(2);
                    expect(instance1()).to.equal(1);
                    expect(instance1()).to.equal(2);
                });
            });

            it('by a constructor', function() {
                return this.injective.import(['./lib/constructor', './lib/constructor']).then(function(instances) {
                    var instance = instances[0];
                    var instance1 = instances[1];
                    expect(instance.count).to.equal(0);
                    instance.increment();
                    expect(instance.count).to.equal(1);
                    expect(instance1.count).to.equal(0);
                    instance1.increment();
                    expect(instance1.count).to.equal(1);
                });
            });

            it('will automatically resolve if it is a promise', function() {
                return expect(this.injective.import('./lib/promise')).to.eventually.equal(1);
            });
        });

        describe('singleton', function() {
            it('should always return the same instance', function() {
                return this.injective.import(['./lib/singleton', './lib/singleton']).then(function(instance) {
                    expect(instance[0]).to.equal(instance[1]);
                });
            });

            it('consecutive require should always return the same instance', function() {
                var self = this;
                return this.injective.import('./lib/singleton').then(function(instance) {
                    return expect(self.injective.import('./lib/singleton')).to.eventually.equal(instance);
                });
            });
        });
    });

    describe('fromObject()', function() {
        it('injectable', function() {
            var instance = {};
            this.injective.set('instance', instance);
            var injectable = {
                '@inject': ['instance']
            };
            return expect(this.injective.fromObject(injectable)).to.eventually.equal(injectable);
        });

        describe('instantiable', function() {
            it('factory', function() {
                var instance = {};
                var instantiable = function() {
                    return instance;
                };
                instantiable['@type'] = 'factory';
                return expect(this.injective.fromObject(instantiable)).to.eventually.equal(instance);
            });

            it('constructor', function() {
                var Instance = function() {};
                Instance['@type'] = 'constructor';
                return this.injective.fromObject(Instance).then(function(instance) {
                    expect(instance instanceof Instance).to.equal(true);
                });
            });
        });

        it('injectable + instantiable', function() {
            var instance = {};
            this.injective.set('instance', instance);
            var instantiable = function(instance) {
                return instance;
            };
            instantiable['@type'] = 'factory';
            instantiable['@inject'] = ['instance'];
            return expect(this.injective.fromObject(instantiable)).to.eventually.equal(instance);
        });

        it('plain object', function() {
            var instance = {};
            return expect(this.injective.fromObject(instance)).to.eventually.equal(instance);
        });
    });
});