var expect = require('expect.js');
var Injective = require('../lib');
var config = require('./assets/injective');
var module = require('./assets/index');

describe('Injective', function() {
    beforeEach(function() {
        this.module = {
            exports: {}
        };
    });

    describe('isInjectable()', function() {
        it('returns false if module is non-injectable', function() {
            expect(Injective.isInstantiable(this.module)).to.be(false);
        });

        it('returns true if module is injectable', function() {
            this.module.exports['@inject'] = function() {};
            expect(Injective.isInjectable(this.module)).to.be(true);
        });
    });

    describe('isInstantiable()', function() {
        it('returns false if module is non-instantiable', function() {
            expect(Injective.isInstantiable(this.module)).to.be(false);
        });

        it('returns true if module is instantiable', function() {
            this.module.exports['@type'] = 'factory';
            expect(Injective.isInstantiable(this.module)).to.be(true);
        });
    });

    describe('create()', function() {
        it('new context inherits instances from parent context', function() {
            var instance = {};
            var instance1 = {};
            var injective = new Injective();
            injective.define('my_instance', instance);
            var injective_ = injective.create();
            injective_.define('my_instance1', instance1);
            expect(injective_.require(module, 'my_instance')).to.be(instance);
            expect(injective_.require(module, 'my_instance1')).to.be(instance1);
            expect(function() {
                injective.require(module, 'my_instance1');
            }).to.throwException();
        });

        it('new context inherits config from parent context', function() {
            var injective = new Injective(config);
            var injective_ = injective.create();
            var instance = injective_.require(module, 'my_util');
            expect(instance).not.to.be(undefined);
        });
    });

    describe('define()', function() {
        it('define instance', function() {
            var instance = {};
            var injective = new Injective();
            injective.define('my_instance', instance);
            expect(injective.require(module, 'my_instance')).to.be(instance);
        });

        it('defined instance is always singleton', function() {
            var instance = {};
            var injective = new Injective();
            injective.define('my_instance', instance);
            expect(injective.require(module, 'my_instance')).to.be(instance);
            expect(injective.require(module, 'my_instance')).to.be(instance);
        });
    });

    describe('require()', function() {
        beforeEach(function() {
            this.injective = new Injective(config);
        });

        describe('resolve dependencies', function() {
            it('bundles defined in config', function() {
                var deps = this.injective.require(module, 'group_a');
                expect(deps).to.have.length(2);
            });

            it('paths defined in config', function() {
                var instance = this.injective.require(module, 'my_util');
                expect(instance).not.to.be(undefined);
            });

            it('replace by paths defined in config', function() {
                var instance = this.injective.require(module, 'my_util/index');
                expect(instance).not.to.be(undefined);
            });

            it('relative path', function() {
                var instance = this.injective.require(module, './lib/factory');
                expect(instance).not.to.be(undefined);
            });

            // This test case assume the current directory is the project directory
            it('absolute path will get resolved relative to current directory', function() {
                var instance = this.injective.require(module, '/test/assets/lib/factory');
                expect(instance).not.to.be(undefined);
            });

            it('fallback to native require if nothing match', function() {
                var instance = this.injective.require(module, 'nice_util');
                expect(instance).not.to.be(undefined);
            });
        });

        describe('create instance', function() {
            it('by a factory function', function() {
                var instance = this.injective.require(module, './lib/factory');
                var instance1 = this.injective.require(module, './lib/factory');

                expect(instance()).to.be(1);
                expect(instance()).to.be(2);

                expect(instance1()).to.be(1);
                expect(instance1()).to.be(2);
            });

            it('by a constructor', function() {
                var instance = this.injective.require(module, './lib/constructor');
                var instance1 = this.injective.require(module, './lib/constructor');

                expect(instance.count).to.be(0);
                instance.increment();
                expect(instance.count).to.be(1);

                expect(instance1.count).to.be(0);
                instance1.increment();
                expect(instance1.count).to.be(1);
            });
        });

        describe('singleton', function() {
            it('should always return the same instance', function() {
                var instance = this.injective.require(module, './lib/singleton');
                var instance1 = this.injective.require(module, './lib/singleton');
                expect(instance).to.be(instance1);
            });
        });
    });

    describe('install()', function() {
        it('static inject', function() {
            var injective = Injective.install(config);
            var util = require('./assets/lib/static_inject');
            expect(util).not.to.be(undefined);
        });
    });
});