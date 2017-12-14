/*eslint no-console: ["error", { allow: ["info", "warn", "error"] }] */
'use strict';

let LambdaLogger = require('./lambda-logger');

/**
 * Utility class that provides methods to generate wrappers for AWS lambda
 * functions. These wrappers allow the initialzation of environment specific
 * config and log files.
 */
class HandlerWrapper {
    /**
     * @param {String} appName Name of the application that contains the
     *        lambda functions.
     */
    constructor(appName) {
        if (typeof appName !== 'string' || appName.length <= 0) {
            throw new Error('Invalid app name specified (arg #1)');
        }

        this._appName = appName;
    }


    /**
     * Initializes the alias based on lambda invocation parameters. This value
     * will be used as a prefix to configuration lookups, thus enabling
     * environment specific configuration specification.
     *
     * @param {String} arn Reference to the lambda invocation arn.
     *
     * @return {String} The lambda alias value
     */
    _initAlias(arn) {
        const startTime = Date.now();

        let alias = arn.split(':')[7];
        alias = (alias === undefined || alias === '$LATEST') ? '' : alias;

        const delta = Date.now() - startTime;
        console.info(`Lambda alias initialized (${alias}): [${delta} ms]`);
        return alias;
    }

    /**
     * Initializes the logger provider for the specific lambda, based on
     * environment specific config.
     *
     * @param {Object} logConfig Reference to the environment specific
     *        configuration file.
     * @param {String} lambdaName Name of the lambda function which will be
     *        used to generate the logger instance.
     * @param {String} alias The lambda alias name
     * @param {Number} lambdaStartTime The start timestamp of the lambda function.
     *
     * @return {Object} Reference to a logger instance for the current lambda.
     */
    _initLogger(logConfig, lambdaName, alias, lambdaStartTime) {
        const startTime = Date.now();
        const loggerProvider = new LambdaLogger(this._appName, logConfig.level);
        const logger = loggerProvider.getLogger(lambdaName, alias, lambdaStartTime);

        const delta = Date.now() - startTime;
        console.info(`Logger initialized (${logConfig.level}): [${delta} ms]`);

        return logger;
    }

    /**
     * Creates an AWS Lambda handler that wraps the specified handler. The
     * wrapper initializes environment specific config and logging before
     * delegating teh actual lambda execution to the handler.
     *
     * @param {Function} handler Reference to the AWS lambda handler that
     *        will be wrapped by this method.
     * @param {String} lambdaName Name used to identify the lambda function
     *        in logs.
     *
     * @return {Function} A wrapped handler that will perform some
     *         initialization prior to invoking the original handler.
     */
    wrap(handler, lambdaName) {
        if (typeof handler !== 'function') {
            throw new Error('Invalid handler specified (arg #1)');
        }

        if (typeof lambdaName !== 'string' || lambdaName.length <= 0) {
            throw new Error('Invalid lambda function name specified (arg #2)');
        }

        return (event, context, callback) => {
            const lambdaStartTime = Date.now();
            const alias = this._initAlias(context.invokedFunctionArn);
            // This needs to happen **after** the enviroment has been
            // initialized.
            const config = require('config');
            const logger = this._initLogger(config.get('log'), lambdaName, alias, lambdaStartTime);

            try {
                if (event.__LAMBDA_KEEP_WARM) {
                    // The invocation is intended to keep the lambda warm, and does
                    // not require actual code execution.
                    logger.timespan('EXECUTION_TIME');
                    logger.info('Keep warm request received. Actual lambda handler will not be invoked');
                    callback(null);
                } else {
                    handler(event, context, callback, {
                        logger,
                        env: alias,
                        alias,
                        config
                    });
                }
            } catch (ex) {
                const message = (ex instanceof Error) ? ex.message : ex;
                logger.error(ex, 'Unandled error thrown by lambda handler. This error must be handled within the lambda function handler.');
                logger.timespan('EXECUTION_TIME');
                callback(new Error(`[Error] Unhandled error executing lambda. Details: ${message}`));
            }
        };
    }
}

module.exports = HandlerWrapper;
