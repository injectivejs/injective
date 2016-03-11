#!/usr/bin/env node

var path = require('path');
var program = require('commander');
var debug = require('debug')('injective-cli');
var pkg = require('../package');
var Injective = require('../lib');

if (require.main === module) {
    program.version(pkg.version).description(pkg.description);
    var injective = Injective(module).set('pkg', pkg).set('program', program);
    injective.import('./run').then(function(run) {
        // Default command
        if (!process.argv.slice(2).length) {
            var config = {};

            try {
                config = require(path.join(process.cwd(), 'injective'));
            } catch (err) { /* It is ok */ }

            run(config.main || process.cwd(), config);
            return;
        }

        return injective.import('injective-cli').catch(function(err) {
            debug('Failed to load injective-cli: ' + err.message);
        }).then(function() {
            program.parse(process.argv);
        });
    });
}
