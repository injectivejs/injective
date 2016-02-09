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
        it('new context inherits instances from parent context', function(done) {
            var instance1 = {};
            var instance2 = {};
            var injective = new Injective(module);
            injective.define('instance1', instance1);
            var injective_ = injective.create();
            injective_.define('instance2', instance2);

            injective_.require('instance1').then(function(instance) {
                expect(instance).to.be(instance1);
                return injective_.require('instance2');
            }).then(function(instance) {
                expect(instance).to.be(instance2);
                return injective.require('instance2')
            }).catch(function(err) {
                expect(err).not.to.be(undefined);
            }).then(done, done);
        });

        it('new context inherits config from parent context', function(done) {
            var injective = new Injective(module, config);
            var injective_ = injective.create();
            injective_.require('my_util').then(function(instance) {
                expect(instance).not.to.be(undefined);
            }).then(done, done);
        });
    });

    describe('define()', function() {
        it('define instance', function(done) {
            var instance1 = {};
            var injective = new Injective(module);
            injective.define('instance1', instance1);
            injective.require('instance1').then(function(instance) {
                expect(instance).to.be(instance1);
            }).then(done, done);
        });

        it('defined instance is always singleton', function(done) {
            var instance1 = {};
            var injective = new Injective(module);
            injective.define('instance', instance1);
            injective.require('instance').then(function(instance) {
                expect(instance).to.be(instance1);
                return injective.require('instance');
            }).then(function(instance) {
                expect(instance).to.be(instance1);
            }).then(done, done);
        });
    });

    describe('require()', function() {
        beforeEach(function() {
            this.injective = new Injective(module, config);
        });

        describe('resolve dependencies', function() {
            it('using bundles defined in config', function(done) {
                this.injective.require('group_a').then(function(instance) {
                    expect(instance).to.have.length(2);
                }).then(done, done);
            });

            it('using paths defined in config', function(done) {
                this.injective.require('my_util').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                }).then(done, done);
            });

            it('replace by paths defined in config', function(done) {
                this.injective.require('my_util/index').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                }).then(done, done);
            });

            it('using relative path', function(done) {
                this.injective.require('./lib/factory').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                }).then(done, done);
            });

            // This test case assume the current directory is the project directory
            it('using absolute path will get resolved relative to current directory', function(done) {
                this.injective.require('/test/assets/lib/factory').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                }).then(done, done);
            });

            it('fallback to native require if nothing match', function(done) {
                this.injective.require('nice_util').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                }).then(done, done);
            });

            it('using the special "injective" dependency will return the injective instance in the current context', function(done) {
                this.injective.require('./lib/injective').then(function(instance) {
                    expect(instance).not.to.be(undefined);
                }).then(done, done);
            });
        });

        describe('create instance', function() {
            it('by a factory function', function(done) {
                var self = this;
                this.injective.require('./lib/factory').then(function(instance) {
                    expect(instance()).to.be(1);
                    expect(instance()).to.be(2);
                    return self.injective.require('./lib/factory');
                }).then(function(instance) {
                    expect(instance()).to.be(1);
                    expect(instance()).to.be(2);
                }).then(done, done);
            });

            it('by a constructor', function(done) {
                var self = this;
                this.injective.require('./lib/constructor').then(function(instance) {
                    expect(instance.count).to.be(0);
                    instance.increment();
                    expect(instance.count).to.be(1);
                    return self.injective.require('./lib/constructor');
                }).then(function(instance) {
                    expect(instance.count).to.be(0);
                    instance.increment();
                    expect(instance.count).to.be(1);
                }).then(done, done);
            });

            it('will automatically resolve if it is a promise', function(done) {
                this.injective.require('./lib/promise').then(function(instance) {
                    expect(instance).to.be(1);
                }).then(done, done);
            });
        });

        describe('singleton', function() {
            it('should always return the same instance', function(done) {
                this.injective.require(['./lib/singleton', './lib/singleton']).then(function(instance) {
                    expect(instance[0]).to.be(instance[1]);
                }).then(done, done);
            });

            it('consecutive require should always return the same instance', function(done) {
                var self = this;
                this.injective.require('./lib/singleton').then(function(instance) {
                    return self.injective.require('./lib/singleton').then(function(instance2) {
                        expect(instance).to.be(instance2);
                    });
                }).then(done, done);
            });
        });
    });
});