module.exports = exports = Counter;
exports['@type'] = 'constructor';
exports['@inject'] = ['./factory'];

function Counter(counter) {
    this.counter = counter;
    this.count = 0;
}

Counter.prototype.increment = function() {
    this.count = this.counter();
    return this.count;
};