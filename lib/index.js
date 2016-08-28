/* jshint node:true, expr:true */
'use strict';


module.exports = {
    /**
     * Returns a wrapper class for lambda functions.
     */
    HandlerWrapper: require('./handler-wrapper'),

    /**
     * Returns a utility class for environment specific checks and actions.
     */
    Environment: require('./environment')
};
