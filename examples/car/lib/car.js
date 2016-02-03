var logger = console;

module.exports = exports = Car;
exports['@type'] = 'constructor';
exports['@singleton'] = true;
exports['@require'] = ['engine', './tires'];
exports['@inject'] = function(Logger) {
    logger = new Logger('Car');
};
exports['@inject']['@require'] = ['logger'];

function Car(engine, tires) {
    this.engine = engine;
    this.tires = tires;
    this.addons = [];
}

Car.prototype.drive = function() {
    logger.log('Driving');
};

Car.prototype.installAddon = function(addon) {
    this.addons.push(addon);
};

Car.prototype.showCondition = function() {
    logger.log('Engine condition: ' + this.engine.getCondition());
    logger.log('Tires condition: ' + this.tires.getCondition());
    this.addons.forEach(function(addon) {
        logger.log(addon.name + ' condition: ' + addon.getCondition());
    });
};