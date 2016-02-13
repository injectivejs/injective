module.exports = exports = main;
exports['@type'] = 'factory';
exports['@require'] = ['car'];

function main(car) {
    car.showCondition();
    car.drive();
}