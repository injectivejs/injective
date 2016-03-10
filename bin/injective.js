#!/usr/bin/env node

var path = require('path');
var program = require('commander');
var debug = require('debug')('injective-cli');
var pkg = require('../package');
var Injective = require('../lib');

if (require.main === module) {
    program.version(pkg.version).description(pkg.description);
    Injective(module).set('pkg', pkg).set('program', program).import(['./run', 'injective-cli']).catch(function(err) {
        debug('Failed to load injective-cli: ' + err.message);
    }).then(function(instances) {
        // Default command
        if (!process.argv.slice(2).length) {
            var run = instances[0];
            var config = {};

            try {
                config = require(path.join(process.cwd(), 'injective'));
            } catch (err) { /* It is ok */ }

            run(config.main || process.cwd(), config);
            return;
        }

        program.parse(process.argv);
    });
}