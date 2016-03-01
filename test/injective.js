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
        it('should return false if module does not contain meta data', function() {
            expect(Injective.isInstantiable(function() {})).to.be.false;
        });

        it('should return false if module is not a function', function() {
            expect(Injective.isInstantiable({
                '@type': 'factory'
            })).to.be.false;
        });

        it('should return true if module is instantiable', function() {
            var instantiable = function() {};
            instantiable['@type'] = 'factory';
            expect(Injective.isInstantiable(instantiable)).to.be.true;
        });
    });

    describe('isInjectable()', function() {
        it('returns false if module is non-injectable', function() {
            expect(Injective.isInjectable({})).to.be.false;
        });

        it('returns true if module is injectable', function() {
            expect(Injective.isInjectable({
                '@inject': []
            })).to.be.true;
        });
    });

    describe('create()', function() {
        it('should inherits instances from parent context while not affecting parent context', function() {
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

        it('should inherits config from parent context', function() {
            var injective_ = this.injective.create();
            return expect(injective_.import('my_util')).not.to.eventually.be.undefined;
        });
    });

    describe('set()', function() {
        it('should be retrieved by get()', function() {
            var instance = {};
            this.injective.set('instance', instance);
            expect(this.injective.get('instance')).to.equal(instance);
        });

        it('should retrieved by import()', function() {
            var instance = {};
            this.injective.set('instance', instance);
            return expect(this.injective.import('instance')).to.eventually.equal(instance);
        });

        it('should be singleton', function() {
            var self = this;
            var instance = {};
            this.injective.set('instance', instance);
            return expect(this.injective.import('instance')).to.eventually.equal(instance).then(function() {
                return expect(self.injective.import('instance')).to.eventually.equal(instance);
            });
        });
    });

    describe('get()', function() {
        it('should retrieve instance defined by set()', function() {
            var instance = {};
            this.injective.set('instance', instance);
            expect(this.injective.get('instance')).to.equal(instance);
        });

        it('should return undefined if instance not defined', function() {
            expect(this.injective.get('instance')).to.be.undefined;
        });
    });

    describe('has()', function() {
        it('should tell whether a module is defined in the runtime context', function() {
            var instance = {};
            this.injective.set('instance', instance);
            expect(this.injective.has('instance')).to.be.true;
            expect(this.injective.has('not_exist')).to.be.false;
        });
    });

    describe('delete()', function() {
        it('shoulde delete module from runtime context', function() {
            var instance = {};
            this.injective.set('instance', instance);
            this.injective.delete('instance');
            expect(this.injective.has('instance')).to.be.false;
        });
    });

    describe('register()', function() {
        describe('using meta data', function() {
            it('should support factory', function() {
                var instance = {};
                var factory = function() {
                    return instance;
                };
                factory['@type'] = 'factory';
                this.injective.register('factory', factory);
                return expect(this.injective.import('factory')).to.eventually.equal(instance);
            });

            it('should support constructor', function() {
                var Constructor = function() {};
                Constructor['@type'] = 'constructor';
                this.injective.register('constructor', Constructor);
                return expect(this.injective.import('constructor')).to.eventually.be.instanceof(Constructor);
            });
        });

        describe('using options', function() {
            it('should support factory', function() {
                var instance = {};
                var factory = function() {
                    return instance;
                };
                this.injective.register('factory', factory, {
                    type: 'factory'
                });
                return expect(this.injective.import('factory')).to.eventually.equal(instance);
            });

            it('should support constructor', function() {
                var Constructor = function() {};
                this.injective.register('constructor', Constructor, {
                    type: 'constructor'
                });
                return expect(this.injective.import('constructor')).to.eventually.be.instanceof(Constructor);
            });
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
                return expect(this.injective.import('my_util')).not.to.eventually.be.undefined;
            });

            it('replace by paths defined in config', function() {
                return expect(this.injective.import('my_util/index')).not.to.eventually.be.undefined;
            });

            it('using relative path', function() {
                return expect(this.injective.import('./lib/factory')).not.to.eventually.be.undefined;
            });

            // This test case assume the current directory is the project directory
            it('using relative path in config will get resolved relative to current directory', function() {
                return expect(this.injective.import('factory')).not.to.eventually.be.undefined;
            });

            it('fallback to native require if nothing match', function() {
                return expect(this.injective.import('nice_util')).not.to.eventually.be.undefined;
            });

            it('using the special "injective" dependency will return the injective instance in the current context', function() {
                return expect(this.injective.import('./lib/injective')).not.to.eventually.be.undefined;
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
                return expect(this.injective.fromObject(Instance)).to.eventually.be.instanceof(Instance);
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