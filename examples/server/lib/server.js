var Router = require('router');
var logger = console;

module.exports = exports = Server;
exports['@type'] = 'constructor';
exports['@singleton'] = true;
exports['@require'] = ['injective', 'logger'];

function Server(injective, Logger) {
    this.injective = injective;
    this.logger = new Logger('Server');
}

Server.prototype.handle = function(request, response) {
    logger.log('Received request with path: ' + request.path);
    var router = new Router();
    this.injective.create()
        .define('router', router)
        .define('request', request)
        .define('response', response)
        .require('controllers').then(function() {
            router.handle(request, response);
        });
};

Server.prototype.listen = function(port) {
    logger.log('Server listening on port ' + port);
};