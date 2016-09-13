'use strict';

let _loggerProvider = require('wysknd-log').loggerProvider;

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
     * Initializes the process environment based on the lambda invocation
     * qualifiers. This will also impact how environment specific configuration
     * is loaded.
     * 
     * @param {String} arn Reference to the lambda invocation arn.
     *
     * @return {String} The process environemnt (NODE_ENV) value for the lambda.
     */
    _initEnv(arn) {
        const startTime = Date.now();

        const alias = arn.split(':')[7];
        const env = (alias === undefined || alias === '$LATEST') ? 'na' : alias;
        process.env.NODE_ENV = env;

        const delta = Date.now() - startTime;
        console.info(`Configuration initialized (${process.env.NODE_ENV}): [${delta} ms]`);
        return env;
    }

    /**
     * Initializes the logger provider for the specific lambda, based on
     * environment specific config.
     * 
     * @param {Object} logConfig Reference to the environment specific
     *        configuration file.
     * @param {String} lambdaName Name of the lambda function which will be
     *        used to generate the logger instance.
     * @param {String} env The process environment for the lambda.
     *
     * @return {Object} Reference to a logger instance for the current lambda.
     */
    _initLogger(logConfig, lambdaName, env) {
        const startTime = Date.now();
        _loggerProvider.configure({
            appName: this._appName,
            logLevel: logConfig.level
        });

        const loggerProps = {
            env: env
        };
        const logger = _loggerProvider.getLogger(lambdaName, loggerProps);

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
            const env = this._initEnv(context.invokedFunctionArn);
            // This needs to happen **after** the enviroment has been
            // initialized.
            const config = require('config');
            const logger = this._initLogger(config.get('log'), lambdaName, env);

            try {
                handler(event, context, callback, {
                    logger: logger,
                    env: env,
                    config: config
                });
            } catch (ex) {
                const message = (ex instanceof Error) ? ex.message : ex;
                callback(new Error(`[Error] Error executing lambda. Details: ${message}`));
            }
        };
    }
}

module.exports = HandlerWrapper;
