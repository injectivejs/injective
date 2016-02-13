var expect = require('expect.js');
var Injective = require('../lib');
var config = require('./assets/injective');
var module = require('./assets/index');

describe('Injective', function() {
    describe('isInstantiable()', function() {
        it('returns false if module is non-instantiable', function() {
            expect(Injective.isInstantiable({})).to.be(false);
        });

        it('returns true if module is instantiable', function() {
            expect(Injective.isInstantiable({
                '@type': 'factory'
            })).to.be(true);
        });
    });

    describe('create()', function() {
        it('new context inherits instances from parent context', function() {
            var instance1 = {};
            var instance2 = {};
            var injective = new Injective(module);
            injective.define('instance1', instance1);
            var injective_ = injective.create();
            injective_.define('instance2', instance2);

            return injective_.require('instance1').then(function(instance) {
                expect(instance).to.be(instance1);
                return injective_.require('instance2');
            }).then(function(instance) {
                expect(instance).to.be(instance2);
                return injective.require('instance2')
            }).catch(function(err) {
                expect(err).not.to.be(undefined);
            });
        });

        it('new context inherits config from parent context', function() {
            var injective = new Injective(module, config);
            var injective_ = injective.create();
            return injective_.require('my_util').then(function(instance) {
                expect(instance).not.to.be(undefined);
            });
        });
    });

    describe('define()', function() {
        it('define instance', function() {
            var instance1 = {};
            var injective = new Injective(module);
            injective.define('instance1', instance1);
            return injective.require('instance1').then(function(instance) {
                expect(instance).to.be(instance1);
            });
        });

        it('defined instance is always singleton', function() {
            var instance1 = {};
            var injective = new Injective(module);
            injective.define('instance', instance1);
            return injective.require('instance').then(function(instance) {
                expect(instance).to.be(instance1);
                return injective.require('instance');
            }).then(function(instance) {
                expect(instance).to.be(instance1);
            });
        });
    });

    describe('require()', function() {
        beforeEach(function() {
            this.injective = new Injective(module, config);
        });

        describe('resolve dependencies', function() {
            it('using bundles defined in config', function() {
                return this.injective.require('group_a').then(function(instance) {
                    expect(instance).to.have.length(2);
                });
            });

            it('using paths defined in config', function() {
                return this.injective.require('my_util').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                });
            });

            it('replace by paths defined in config', function() {
                return this.injective.require('my_util/index').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                });
            });

            it('using relative path', function() {
                return this.injective.require('./lib/factory').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                });
            });

            // This test case assume the current directory is the project directory
            it('using absolute path will get resolved relative to current directory', function() {
                return this.injective.require('/test/assets/lib/factory').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                });
            });

            it('fallback to native require if nothing match', function() {
                return this.injective.require('nice_util').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                });
            });

            it('using the special "injective" dependency will return the injective instance in the current context', function() {
                return this.injective.require('./lib/injective').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                });
            });
        });

        describe('create instance', function() {
            it('by a factory function', function() {
                var self = this;
                return this.injective.require('./lib/factory').then(function(instance) {
                    expect(instance()).to.be(1);
                    expect(instance()).to.be(2);
                    return self.injective.require('./lib/factory');
                }).then(function(instance) {
                    expect(instance()).to.be(1);
                    expect(instance()).to.be(2);
                });
            });

            it('by a constructor', function() {
                var self = this;
                return this.injective.require('./lib/constructor').then(function(instance) {
                    expect(instance.count).to.be(0);
                    instance.increment();
                    expect(instance.count).to.be(1);
                    return self.injective.require('./lib/constructor');
                }).then(function(instance) {
                    expect(instance.count).to.be(0);
                    instance.increment();
                    expect(instance.count).to.be(1);
                });
            });

            it('will automatically resolve if it is a promise', function() {
                return this.injective.require('./lib/promise').then(function(instance) {
                    expect(instance).to.be(1);
                });
            });
        });

        describe('singleton', function() {
            it('should always return the same instance', function() {
                return this.injective.require(['./lib/singleton', './lib/singleton']).then(function(instance) {
                    expect(instance[0]).to.be(instance[1]);
                });
            });

            it('consecutive require should always return the same instance', function() {
                var self = this;
                return this.injective.require('./lib/singleton').then(function(instance) {
                    return self.injective.require('./lib/singleton').then(function(instance2) {
                        expect(instance).to.be(instance2);
                    });
                });
            });
        });
    });
});