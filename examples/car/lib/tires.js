module.exports = exports = Tires;
module.exports['@type'] = 'constructor';

function Tires() {}

Tires.prototype.getCondition = function() {
    return 'GOOD';
};