'use strict';

const _clone = require('clone');

/**
 * Utility class that performs environment related checks, and exposes
 * methods for environment specific string generation.
 */
class Environment {
    /**
     * @param {String} env The current environment value.
     * @param {Array} [envMap = {
     *            dev: { token: '-dev' },
     *            qa: { token: '-qa' },
     *            prod: { token: '' }
     *        } ] An optional environment map that maps supported environment
     *        values to string generation tokens.
     * @param {String} [separator='-'] An optional separator value for
     *        generated strings.
     */
    constructor(env, envMap, separator) {
        if (typeof env !== 'string' || env.length <= 0) {
            env = undefined;
        }
        if (!envMap || (envMap instanceof Array) || typeof envMap !== 'object') {
            envMap = {
                dev: 'dev',
                qa: 'qa',
                prod: ''
            };
        }
        if (typeof separator !== 'string') {
            separator = '-';
        }
        this._env = env;
        this._separator = separator;
        this._envMap = _clone(envMap);
        this._envToken = this._envMap[env];
    }

    /**
     * Gets the current environment string value.
     *
     * @return {String} The current environment string value.
     */
    get env() {
        return this._env;
    }

    /**
     * Gets the separator value used when generated token strings.
     *
     * @return {String} The separator value used for string generation.
     */
    get separator() {
        return this._separator;
    }

    /**
     * Returns a value that specifies whether or not the current environment is
     * valid based on the specified environment map.
     * 
     * @return {Boolean} True if the environment is supported, false otherwise.
     */
    get isValid() {
        return typeof this._envToken === 'string';
    }

    /**
     * Returns a string that is suffixed by the current environment's token
     * value.
     * 
     * @param {String} value The value to be suffixed by the token value.
     *
     * @return {String} The original value suffixed with the environment
     *         specific token.
     */
    getSuffixString(value) {
        if (typeof value !== 'string') {
            throw new Error('Invalid value specified (arg #1)');
        }
        if (!this.isValid) {
            return;
        }
        const separator = (this._envToken.length > 0) ? this.separator : '';
        return `${value}${separator}${this._envToken}`;
    }
}

module.exports = Environment;
