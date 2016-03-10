var Module = require('module');
var path = require('path');

module.exports = exports = factory;
exports['@type'] = 'factory';
exports['@inject'] = ['injective', 'program'];

function factory(injective, program) {
    var Injective = injective.constructor;

    program.command('run [names...]')
        .description('Run injective program from a given entry point(s)')
        .option('-c, --config <path>', 'Path to config file')
        .action(function(names, program) {
            var config = {};
            var configPath = program.config;

            if (typeof configPath === 'undefined') {
                try {
                    config = require(path.join(process.cwd(), 'injective'));
                } catch (err) { /* It is ok */ }
            } else {
                if (/^\./.test(configPath) || /^\.\./.test(configPath)) {
                    configPath = path.resolve(process.cwd(), configPath);
                }

                config = require(configPath);
            }


            run(names.length <= 0 ? (config.main || process.cwd()) : names, config);
        });

    module.exports = exports = run;

    function run(names, config) {
        var module = new Module('injective', null);
        module.paths = Module._nodeModulePaths(process.cwd());
        process.mainModule = module;
        Injective(module, config).import(names).catch(function(err) {
            console.error(err.stack);
        });
    }

    return exports;
}