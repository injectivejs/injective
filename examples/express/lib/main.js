var http = require('http');

module.exports = exports = main;
exports['@type'] = 'factory';
exports['@require'] = ['app', 'db', 'logger'];

function main(app, db, Logger) {
    var logger = new Logger('Main');
    var server = http.createServer(app);
    server.listen(6894, function() {
        logger.log('Server listening on port 6894');
    });
    db.connect();
}