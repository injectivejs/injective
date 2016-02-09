module.exports = exports = factory;
exports['@type'] = 'factory';
exports['@require'] = ['injective'];

function factory(injective) {
    return injective.require('./factory');
}