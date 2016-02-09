module.exports = exports = main;
exports['@type'] = 'factory';
exports['@singleton'] = true;
exports['@require'] = ['car'];

function main(car) {
    car.showCondition();
    car.drive();
}