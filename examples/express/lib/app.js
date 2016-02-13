var express = require('express');

module.exports = exports = factory;
exports['@type'] = 'factory';
exports['@require'] = ['injective', 'logger'];
exports['@singleton'] = true;

function factory(injective) {
    var app = express();
    app.use(function(req, res, next) {
        var router = express.Router();
        injective.create()
            .define('router', router)
            .define('request', req)
            .define('response', res)
            .require('controllers').then(function() {
                router(req, res, next);
            }).catch(next);
    });
    return app;
}