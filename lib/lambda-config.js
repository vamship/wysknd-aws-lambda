'use strict';

let _rc = require('rc');
let _dp = require('dot-prop');

/**
 * Utility class that initializes a config object based on the current
 * application and alias information.
 */
class LambdaConfig {
    /**
     * @param {String} appName The name of the application.
     * @param {String} alias The alias for the application.
     */
    constructor(appName, alias) {
        if (typeof appName !== 'string' || appName.length <= 0) {
            throw new Error('Invalid appName specified (arg #1)');
        }
        if (typeof alias !== 'string' || alias.length <= 0) {
            throw new Error('Invalid alias specified (arg #2)');
        }

        this._config = _rc(appName, {});
        this._alias = alias;
    }

    /**
     * Returns a specific configuration property based on the key value
     * provided. Keys can be specified using the dot notation.
     *
     * @param {String} key The configuration key
     * @return {String|Number|Boolean|Object} The configuration value
     *         corresponding to the key. Undefined will be returned if no
     *         property exists for the specified key.
     */
    get(key) {
        if(typeof key !== 'string' || key.length <= 0) {
            return;
        }
        key = `${this._alias}.${key}`;
        if(!_dp.has(this._config, key)) {
            return;
        }
        return _dp.get(this._config, key);
    }
}

module.exports = LambdaConfig;
