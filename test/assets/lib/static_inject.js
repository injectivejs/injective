var util;

module.exports = exports = function() {
    return util;
};
exports['@inject'] = function(util_) {
    util = util_;
};
exports['@inject']['@require'] = ['my_util'];