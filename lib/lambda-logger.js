'use strict';

const _shortId = require('shortid');
let _loggerProvider = require('wysknd-log').loggerProvider;

/**
 * Utility class that initializes a logger object, and augments it with
 * specailized methods for lambda functions.
 */
class LambdaLogger {
    /**
     * @param {String} appName The name of the application.
     * @param {String} logLevel The log level to use when logging.
     */
    constructor(appName, logLevel) {
        if (typeof appName !== 'string' || appName.length <= 0) {
            throw new Error('Invalid appName specified (arg #1)');
        }
        if (typeof logLevel !== 'string' || logLevel.length <= 0) {
            throw new Error('Invalid logLevel specified (arg #2)');
        }

        _loggerProvider.configure({
            appName,
            logLevel
        });
    }

    /**
     * Returns a reference to a logger object with additional lambda specific
     * methods injected into it.
     *
     * @param {String} lambdaName The name of the lambda function.
     * @param {String} alias The alias of the lambda function.
     * @param {Number} startTime The start timestamp of the lambda function.
     *
     * @return {Object} A logger object containing specialized methods.
     */
    getLogger(lambdaName, alias, startTime) {
        if (typeof lambdaName !== 'string' || lambdaName.length <= 0) {
            throw new Error('Invalid lambdaName specified (arg #1)');
        }
        if (typeof alias !== 'string') {
            throw new Error('Invalid alias specified (arg #2)');
        }
        if (typeof startTime !== 'number' || startTime <= 0) {
            throw new Error('Invalid startTime specified (arg #3)');
        }
        const logger = _loggerProvider.getLogger(lambdaName, {
            env: alias,
            alias,
            executionId: _shortId.generate()
        });

        logger.metrics = (metric, value, props) => {
            props = Object.assign({}, props, {
                metric,
                value
            });
            logger.info(props);
        };

        logger.timespan = (metric, metricStartTime, props) => {
            metricStartTime = metricStartTime || startTime;
            props = Object.assign({}, props, {
                metric,
                value: Date.now() - metricStartTime
            });
            logger.info(props);
        };

        return logger;
    }
}

module.exports = LambdaLogger;
