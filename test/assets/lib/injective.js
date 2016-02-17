module.exports = exports = factory;
exports['@type'] = 'factory';
exports['@inject'] = ['injective'];

function factory(injective) {
    return injective.import('./factory');
}