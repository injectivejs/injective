module.exports = exports = main;
exports['@type'] = 'factory';
exports['@inject'] = ['car'];

function main(car) {
    car.drive();
    car.showCondition();
}