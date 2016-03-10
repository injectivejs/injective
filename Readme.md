# Injective
[![Travis Build](https://api.travis-ci.org/injectivejs/injective.svg "Travis Build")](https://travis-ci.org/injectivejs/injective)
[![NPM Version](http://img.shields.io/npm/v/injective.svg?style=flat)](https://www.npmjs.org/package/injective)
[![NPM Downloads](https://img.shields.io/npm/dm/injective.svg?style=flat)](https://www.npmjs.org/package/injective)

Dependency injection for Node.js.

```javascript
// some_class.js
module.exports = exports = SomeClass;
exports['@type'] = 'constructor';
exports['@inject'] = ['./greeter'];

function SomeClass(greeter) {
    this.greeter = greeter;
}

SomeClass.prototype.doSomething = function(name) {
    this.greeter.greet(name);
}
```

```javascript
// greeter.js
module.exports = exports = greeter;
exports['@type'] = 'factory';

function greeter() {
    return {
        greet: function(text) {
            console.log(text);
        }
    };
});
```

```javascript
// index.js
var Injective = require('injective');
var injective = new Injective(module);
injective.import('./some_class').then(function(someClass) {
    someClass.doSomething('Hello World!'); // Hello World!
});
```

## Installation
```bash
$ npm install injective
```
Or you can use it globally
```bash
$ npm install -g injective
```
## Getting start
Let's look at the classic car & engine example to illustrate how it works.
Assuming we have the following project structure.
```
├ lib/
|   ├ car.js
|   └ main.js
|- node_modules/
|   ├ component-engine/
|   |   └  index.js
|   └ lib-logger/
|       └  index.js
├ index.js
└ injective.json
```
Let's first look at the ``car.js``. It is a ``Car`` class which requires two dependenies with name (alias) ``logger`` and ``engine``.
```javascript
// lib/car.js
module.exports = exports = Car;
exports['@type'] = 'constructor';
exports['@inject'] = ['logger', 'engine'];
exports['@singleton'] = true;

function Car(Logger, engine) {
    this.logger = new Logger('Car');
    this.engine = engine;
}

Car.prototype.drive = function() {
    this.engine.start();
    this.logger.log('Driving');
};
```
The ``Engine`` is also a class which only need a logger.
```javascript
// node_modules/component-engine/index.js
module.exports = exports = Engine;
exports['@type'] = 'constructor';
exports['@inject'] = ['logger'];

function Engine(Logger) {
    this.logger = new Logger('Engine');
}

Engine.prototype.start = function() {
    this.logger.log('Starting engine...');
};
```
This is the logger module which is a normal nodejs library.
```javascript
// node_modules/lib-logger/index.js
module.exports = exports = Logger;

function Logger(label) {
    this.label = label;
}

Logger.prototype.log = function(message) {
    console.log('[' + this.label + '] ' + message);
};
```

This will be the entry point of our program. It is an ordinary function so its type is ``factory``. We can use the fact that ``car.js`` is in the same directory as ``main.js`` so we may specify the dependency as ``./car``
```javascript
// lib/main.js
module.exports = exports = main;
exports['@type'] = 'factory';
exports['@inject'] = ['./car'];

function main(car) {
    car.drive();
}
```
This is the config file to map the alias we used above to the actual location. Note that ``./`` here means relative to the directory (``process.cwd()``) we run the program . Otherwise it behaves exactly the same as the native ``require()``.
```javascript
// injective.json
{
    "main": "./lib/main",
    "paths": {
        "engine": "component-engine",
        "logger": "lib-logger"
    }
}
```

Finally, to start the application, we can use the global ``injective`` command. It looks for the ``main`` attribute in the ``injective.json`` config file and loads it as the entry point.

```sh
$ injective
[Engine] Starting engine...
[Car] Driving
```

## Configurations
```javascript
{
    "main": "./lib/main",
    "bundles": {
        "controllers": [
            "controller-info",
            "controller-user"
        ]
    },
    "paths": {
        "user": "middleware-user",
        "logger": "lib-logger"
    }
}
```
### main
The entry point where the injective cli will use.
### bundles
A map which maps id to array of dependencies which will be loaded together.
### paths
A map which maps id to the actual location.

## API
### new Injective(module: Module[, config: object])
Create a new injective object.
### set(id: string, instance: object): Injective
Define an instance into runtime context
### get(id: string): object
Get an instance from the runtime context
### has(id: string): boolean
Whether an instance is defined in the runtime context
### delete(id: string): boolean
Delete an instance from the runtime context
### register(id: string, obj: function[, meta: object]): Injective
Dynamically register a module. You may separate the annotations into a ``meta`` object.
### deregister(id: string): boolean
De-register a module
### create(): Injective
Create a new runtime context on top of parent's runtime context (using prototype chain) and inherits from parent's config.
### import(name: string | Array&lt;string&gt;): Promise&lt;object | Array&lt;object&gt;&gt;
Load and initantiate module.
### resolve(name: string): string | Array<string>
Resolve the given path to the absolute path according to the config. Return an array of string if it resolve to a bundle.

## Annotation
Instruction for injective to instantiate and resolve dependencies.
### @type
A module type can be any of the following. Note ``module.exports`` NEED to be a function.
* ``factory``: instantiate the module using normal function invocation
* ``constructor``: instantiate the module using ``new``
```js
module.exports['@type'] = 'factory';
```
### @inject
An array of string to indicate the dependencies to be injected into the module.
Can be in any of the following:
* A bundle defined in ``config.bundles``
* A path defeined in ``config.paths``
* A module id, same as ``require(id)``
* relative path, will resolve the dependency relative to the current module
* absolute path
```js
module.exports['@inject'] = ['/package', './engine', 'tire'];
```
### @singleton
If you specify singleton on your defined module, injective will define that instance in the context after it has been first instantiated. So that when other modules requesting for same module will get the same instance.
```js
module.exports['@singleton'] = true;
```

### @id
Use with ``@singleton`` to give an id to the instance so that other module can use this id to get this instance. Not recommand to use, please use ``config.paths`` instead.
```js
module.exports['@id'] = 'db';
```

### @onError
You can define a error handler to handle error whenever a dependency is failed to be resolved.
```js
module.exports['@onError'] = function(err) {
    console.error(err);
};
```

## Advanced usage
### Async initialization
Injective support asynchronous initialization of a module. Simply use *factory* pattern to define a module and return a *promise*. Injective will use the resolved object as the instance.
```javascript
module.exports = exports = factory;
exports['@type'] = 'factory';
exports['@singleton'] = true;

function factory() {
    var instance = ...
    return Promise.resolve(instance);
}
```
### The special ``injective`` dependency
If you specify ``injective`` as one of the dependencies of your module you will get injected an injective instance which inherits from parent injective instance, with same config and same context. The only difference is when you call ``injective.import()`` with relative path it will import module relative to the current module (like the native ``require()``). One use case is in a http server like express you would like to create separate context for every request, in this case you can use ``injective.create()``.
```javascript
var express = require('express');

module.exports = exports = server;
exports['@type'] = 'factory';
exports['@inject'] = ['injective'];
exports['@singleton'] = true;

function server(injecive) {
    var app = express();
    app.use(function(req, res, next) {
        var router = express.Router();
        injective.create()
            .set('router', router)
            .import('server-controllers')
            .then(function(){
                router(req, res, next);
            }).catch(next);
    });
    return app;
}
```
## License
MIT