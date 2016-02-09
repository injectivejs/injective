var logger = console;

module.exports = exports = Car;
exports['@type'] = 'constructor';
exports['@singleton'] = true;
exports['@require'] = ['logger', 'engine', './tires', 'addons'];

function Car(Logger, engine, tires, addons) {
    var self = this;
    this.logger = new Logger('Car');
    this.engine = engine;
    this.tires = tires;
    this.addons = [];
    addons.forEach(function(addon) {
        self.installAddon(addon);
    });
}

Car.prototype.drive = function() {
    this.logger.log('Driving');
};

Car.prototype.installAddon = function(addon) {
    this.addons.push(addon);
};

Car.prototype.showCondition = function() {
    var self = this;
    this.logger.log('Engine condition: ' + this.engine.getCondition());
    this.logger.log('Tires condition: ' + this.tires.getCondition());
    this.addons.forEach(function(addon) {
        self.logger.log(addon.name + ' condition: ' + addon.getCondition());
    });
};