/* jshint node:true, expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _testHelper = require('wysknd-test');
const _testValueProvider = _testHelper.testValueProvider;
const _consoleHelper = _testHelper.consoleHelper;
const LambdaTestWrapper = _testHelper.aws.LambdaWrapper;
const LambdaTestContext = _testHelper.aws.LambdaContext;
const _rewire = require('rewire');

let HandlerWrapper = null;

describe('HandlerWrapper', () => {
    const DEFAULT_APP_NAME = '__default_app_name__';
    const DEFAULT_LAMBDA_NAME = '__function_name__';
    const DEFAULT_HANDLER = () => {
    };

    function _createWrapper(appName, lambdaName) {
        appName = appName || DEFAULT_APP_NAME;
        lambdaName = lambdaName || DEFAULT_LAMBDA_NAME;
        return new HandlerWrapper(appName, lambdaName);
    }

    beforeEach(() => {
        HandlerWrapper = _rewire('../../lib/handler-wrapper');
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid app name', () => {
            const error = 'Invalid app name specified (arg #1)';
            _testValueProvider.allButString('').forEach((appName) => {
                const testCase = () => {
                    return new HandlerWrapper(appName);
                };
                expect(testCase).to.throw(error);
            });
        });

        it('should return an object with the requried properties and methods', () => {
            const wrapper = _createWrapper();

            expect(wrapper).to.be.an('object');
            expect(wrapper.wrap).to.be.a('function');
        });
    });

    describe('wrap()', () => {
        it('should throw an error if invoked without a valid handler', () => {
            const error = 'Invalid handler specified (arg #1)';
            _testValueProvider.allButFunction().forEach((handler) => {
                const testCase = () => {
                    const wrapper = new HandlerWrapper(DEFAULT_APP_NAME);
                    wrapper.wrap(handler);
                };
                expect(testCase).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid handler', () => {
            const error = 'Invalid lambda function name specified (arg #2)';
            _testValueProvider.allButString('').forEach((lambdaName) => {
                const testCase = () => {
                    const wrapper = new HandlerWrapper(DEFAULT_APP_NAME);
                    wrapper.wrap(DEFAULT_HANDLER, lambdaName);
                };
                expect(testCase).to.throw(error);
            });
        });

        it('should return a function when invoked', () => {
            const wrapper = _createWrapper();
            const handler = wrapper.wrap(DEFAULT_HANDLER, DEFAULT_LAMBDA_NAME);

            expect(handler).to.be.a('function');
        });

        describe('[wrapper behavior]', () => {
            let _loggerProviderMock = null;

            function _initLambdaArgs(alias, event) {
                const handler = _sinon.spy();
                event = event || {};
                const args = new LambdaTestWrapper(handler, event, {
                    alias: alias
                });

                return args;
            }

            function _testEnv(alias, env) {
                env = env || alias;

                const wrapper = _createWrapper();
                const lambdaArgs = _initLambdaArgs(alias);
                const wrappedHandler = wrapper.wrap(lambdaArgs.handler, DEFAULT_LAMBDA_NAME);

                process.env.NODE_ENV = '';
                _invokeHandler(wrappedHandler, lambdaArgs);
                expect(process.env.NODE_ENV).to.equal(env);
            }

            function _invokeHandler(wrappedHandler, lambdaArgs) {
                _consoleHelper.mute();
                const context = (new LambdaTestContext(lambdaArgs.contextProps)).context;
                wrappedHandler(lambdaArgs.event, context, lambdaArgs.callback);
                _consoleHelper.unmute();
            }

            beforeEach(() => {
                //Initialize the config module so that tests don't result in
                //warning messages.
                process.env.NODE_ENV = '';
                require('config');

                _loggerProviderMock = {
                    configure: _sinon.spy(),
                    getLogger: () => {
                    },
                    _logger: {
                        trace: _sinon.spy(),
                        debug: _sinon.spy(),
                        info: _sinon.spy(),
                        warn: _sinon.spy(),
                        error: _sinon.spy(),
                        fatal: _sinon.spy()
                    }
                };
                _loggerProviderMock.getLogger = _sinon.stub(_loggerProviderMock, 'getLogger', () => {
                    return _loggerProviderMock._logger;
                });

                HandlerWrapper.__set__('_loggerProvider', _loggerProviderMock);
            });

            it('should set the NODE_ENV variable to "na" if the lambda invocation is unqualified', () => {
                _testEnv(undefined, 'na');
            });

            it('should set the NODE_ENV variable to "na" if the lambda invocation qualified by the "$LATEST" alias', () => {
                _testEnv('$LATEST', 'na');
            });

            it('should set the NODE_ENV variable to the lambda invocation alias value', () => {
                ['dev', 'stage', 'qa', 'prod', 'foo', 'bar'].forEach((env) => {
                    _testEnv('dev');
                });
            });

            it('should configure the logger provider with the correct app name and log level', () => {
                const appName = '__some_app__';
                const config = require('config');
                const lambdaName = DEFAULT_LAMBDA_NAME;
                const env = 'dev';

                const wrapper = _createWrapper(appName);
                const lambdaArgs = _initLambdaArgs(env);
                const wrappedHandler = wrapper.wrap(lambdaArgs.handler, lambdaName);

                expect(_loggerProviderMock.configure).to.not.have.been.called;
                expect(_loggerProviderMock.getLogger).to.not.have.been.called;

                _invokeHandler(wrappedHandler, lambdaArgs);

                expect(_loggerProviderMock.configure).to.have.been.calledOnce;
                expect(_loggerProviderMock.getLogger).to.have.been.calledOnce;

                const loggerProviderCfg = _loggerProviderMock.configure.args[0][0];
                expect(loggerProviderCfg.appName).to.equal(appName);
                expect(loggerProviderCfg.logLevel).to.equal(config.get('log.level'));

                const loggerNameArg = _loggerProviderMock.getLogger.args[0][0];
                expect(loggerNameArg).to.equal(lambdaName);

                const loggerPropsArg = _loggerProviderMock.getLogger.args[0][1];
                expect(loggerPropsArg).to.be.an('object');
                expect(loggerPropsArg.env).to.equal(env);
                expect(loggerPropsArg.executionId).to.be.a('string').and.to.not.be.empty;
            });

            it('should not invoke the handler if the input event sets the "__LAMBDA_KEEP_WARM" flag to true', () => {
                const wrapper = _createWrapper();
                const lambdaArgs = _initLambdaArgs(undefined, {
                    __LAMBDA_KEEP_WARM: true
                });
                const actualHandler = _sinon.spy();
                const wrappedHandler = wrapper.wrap(actualHandler, DEFAULT_LAMBDA_NAME);

                expect(actualHandler).to.not.have.been.called;

                _invokeHandler(wrappedHandler, lambdaArgs);

                expect(actualHandler).to.not.have.been.called;
            });

            it('should invoke the lambda callback to indicate that handler execution is complete, if the __LAMBDA_KEEP_WARM flag is set to true', (done) => {
                const wrapper = _createWrapper();
                const actualHandler = _sinon.spy();
                const wrappedHandler = wrapper.wrap(actualHandler, DEFAULT_LAMBDA_NAME);

                _consoleHelper.mute();
                wrappedHandler({
                    __LAMBDA_KEEP_WARM: true
                }, new LambdaTestContext({
                    alias: 'dev'
                }).context, (err, data) => {
                    try {
                        expect(err).to.be.null;
                        expect(data).to.be.undefined;
                        done();
                    } catch (ex) {
                        done(ex);
                    }
                }, {});
                _consoleHelper.unmute();
            });

            it('should invoke the handler after configuration is complete', () => {
                const wrapper = _createWrapper();
                const lambdaArgs = _initLambdaArgs();
                const actualHandler = _sinon.spy();
                const expectedContext = (new LambdaTestContext(lambdaArgs.contextProps)).context;
                const wrappedHandler = wrapper.wrap(actualHandler, DEFAULT_LAMBDA_NAME);

                expect(actualHandler).to.not.have.been.called;

                _invokeHandler(wrappedHandler, lambdaArgs);

                expect(actualHandler).to.have.been.calledOnce;
                expect(actualHandler.args[0][0]).to.equal(lambdaArgs.event);
                expect(actualHandler.args[0][1]).to.deep.equal(expectedContext);
                expect(actualHandler.args[0][2]).to.equal(lambdaArgs.callback);
            });

            it('should include logger, env and config as an additional argument to the handler', () => {
                const env = 'foo';
                const wrapper = _createWrapper();
                const lambdaArgs = _initLambdaArgs(env);
                const actualHandler = _sinon.spy();
                const wrappedHandler = wrapper.wrap(actualHandler, DEFAULT_LAMBDA_NAME);

                expect(actualHandler).to.not.have.been.called;

                _invokeHandler(wrappedHandler, lambdaArgs);

                expect(actualHandler).to.have.been.calledOnce;
                const execInfo = actualHandler.args[0][3];
                expect(execInfo).to.be.an('object');
                expect(execInfo.logger).to.equal(_loggerProviderMock._logger);
                // expect(execInfo.logger.metric).to.be.a('function');
                // expect(execInfo.logger.timespan).to.be.a('function');
                expect(execInfo.env).to.equal(env);
                expect(execInfo.config).to.equal(require('config'));
            });

            it('should handle any unhandled exceptions thrown by the handler (error instance thrown)', (done) => {
                const wrapper = _createWrapper();
                const handlerErrorMessage = 'Something went wrong!';
                const expectedErrorMessage = `[Error] Unhandled error executing lambda. Details: ${handlerErrorMessage}`;

                const actualHandler = () => {
                    throw new Error(handlerErrorMessage);
                };
                const wrappedHandler = wrapper.wrap(actualHandler, DEFAULT_LAMBDA_NAME);

                _consoleHelper.mute();
                wrappedHandler({}, new LambdaTestContext({
                    alias: 'dev'
                }).context, (err, data) => {
                    try {
                        expect(err).to.be.an.instanceOf(Error);
                        expect(err.message).to.equal(expectedErrorMessage);
                        done();
                    } catch (ex) {
                        done(ex);
                    }
                }, {});
                _consoleHelper.unmute();
            });

            it('should handle any unhandled exceptions thrown by the handler (string errors thrown)', (done) => {
                const wrapper = _createWrapper();
                const handlerErrorMessage = 'Something went wrong (not an exception object)!';
                const expectedErrorMessage = `[Error] Unhandled error executing lambda. Details: ${handlerErrorMessage}`;

                const actualHandler = () => {
                    throw handlerErrorMessage;
                };
                const wrappedHandler = wrapper.wrap(actualHandler, DEFAULT_LAMBDA_NAME);

                _consoleHelper.mute();
                wrappedHandler({}, new LambdaTestContext({
                    alias: 'dev'
                }).context, (err, data) => {
                    try {
                        expect(err).to.be.an.instanceOf(Error);
                        expect(err.message).to.equal(expectedErrorMessage);
                        done();
                    } catch (ex) {
                        done(ex);
                    }
                }, {});
                _consoleHelper.unmute();
            });
        });
    });
});
