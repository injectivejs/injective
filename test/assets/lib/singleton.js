module.exports = exports = Counter;
exports['@type'] = 'constructor';
exports['@singleton'] = true;

function Counter() {
    this.count = 0;
}

Counter.prototype.increment = function() {
    return ++this.count;
};