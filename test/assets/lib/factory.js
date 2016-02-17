module.exports = exports = factory;
exports['@type'] = 'factory';
exports['@inject'] = ['my_util'];

function factory(util) {
    var count = 0;
    return function() {
        count = util.increment(count);
        return count;
    };
}