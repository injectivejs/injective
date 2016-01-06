var logger;

module.exports = exports = main;
exports['@type'] = 'factory';
exports['@singleton'] = true;
exports['@require'] = ['server', 'db'];
exports['@inject'] = function(Logger) {
    logger = new Logger('Main');
};
exports['@inject']['@require'] = ['logger'];

function main(server, db) {
    server.listen(6894);
    db.connect();

    setTimeout(function() {
        server.handle({
            path: '/info'
        }, {
            end: console.log.bind(console)
        });
        server.handle({
            path: '/user',
            userId: 6894
        }, {
            end: console.log.bind(console)
        });
        server.handle({
            path: '/user',
            userId: 9527
        }, {
            end: console.log.bind(console)
        });
    });
}