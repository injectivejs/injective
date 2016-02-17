var express = require('express');

module.exports = exports = factory;
exports['@type'] = 'factory';
exports['@inject'] = ['injective', 'logger'];
exports['@singleton'] = true;

function factory(injective) {
    var app = express();
    app.use(function(req, res, next) {
        var router = express.Router();
        injective.create()
            .set('router', router)
            .set('request', req)
            .set('response', res)
            .import('controllers').then(function() {
                router(req, res, next);
            }).catch(next);
    });
    return app;
}