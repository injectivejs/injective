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
                var self = this;
                return this.injective.import('./lib/factory').then(function(instance) {
                    expect(instance()).to.equal(1);
                    expect(instance()).to.equal(2);
                    return self.injective.import('./lib/factory');
                }).then(function(instance) {
                    expect(instance()).to.equal(1);
                    expect(instance()).to.equal(2);
                });
            });

            it('by a constructor', function() {
                var self = this;
                return this.injective.import('./lib/constructor').then(function(instance) {
                    expect(instance.count).to.equal(0);
                    instance.increment();
                    expect(instance.count).to.equal(1);
                    return self.injective.import('./lib/constructor');
                }).then(function(instance) {
                    expect(instance.count).to.equal(0);
                    instance.increment();
                    expect(instance.count).to.equal(1);
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
});