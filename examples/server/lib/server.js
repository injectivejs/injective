var Router = require('router');
var logger;

module.exports = exports = Server;
exports['@type'] = 'constructor';
exports['@singleton'] = true;
exports['@require'] = ['injective'];
exports['@inject'] = function(Logger) {
    logger = new Logger('Server');
};
exports['@inject']['@require'] = ['logger'];

function Server(injective) {
    this.injective = injective;
}

Server.prototype.handle = function(request, response) {
    logger.log('Received request with path: ' + request.path);
    var router = new Router();
    var injective = this.injective.create();
    injective.define('router', router);
    injective.define('request', request);
    injective.define('response', response);
    injective.require(module, 'controllers');
    router.handle(request, response);
};

Server.prototype.listen = function(port) {
    logger.log('Server listening on port ' + port);
};