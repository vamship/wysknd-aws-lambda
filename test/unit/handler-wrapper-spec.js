/* jshint node:true, expr:true */
'use strict';

const _shortId = require('shortid');
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
const ObjectMock = _testHelper.ObjectMock;
const _rewire = require('rewire');
const _dp = require('dot-prop');

let HandlerWrapper = null;

describe('HandlerWrapper', () => {
    let _lambdaLoggerMock = null;
    let _lambdaConfigMock = null;

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
        const loggerInstance = {
            trace: _sinon.spy(),
            debug: _sinon.spy(),
            info: _sinon.spy(),
            warn: _sinon.spy(),
            error: _sinon.spy(),
            fatal: _sinon.spy(),
            metrics: _sinon.spy(),
            timespan: _sinon.spy()
        };
        _lambdaLoggerMock = (new ObjectMock()).addMock('getLogger', loggerInstance, true);
        _lambdaLoggerMock._loggerInstance = loggerInstance;

        const configInstance = {
            log: {
                level: 'error'
            }
        };
        _lambdaConfigMock = (new ObjectMock()).addMock('get', (key) => {
            return _dp.get(configInstance, key);
        }, true);
        _lambdaConfigMock._configInstance = configInstance;

        HandlerWrapper = _rewire('../../lib/handler-wrapper');
        HandlerWrapper.__set__('LambdaLogger', _lambdaLoggerMock.ctor);
        HandlerWrapper.__set__('LambdaConfig', _lambdaConfigMock.ctor);
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
            function _initLambdaArgs(alias, event) {
                const handler = _sinon.spy();
                event = event || {};
                const args = new LambdaTestWrapper(handler, event, {
                    alias: alias
                });

                return args;
            }

            function _testAlias(alias, expectedAlias) {
                const wrapper = _createWrapper();
                const lambdaArgs = _initLambdaArgs(alias);
                const wrappedHandler = wrapper.wrap(lambdaArgs.handler, DEFAULT_LAMBDA_NAME);

                expect(lambdaArgs.handler).to.not.have.been.called;
                _invokeHandler(wrappedHandler, lambdaArgs);
                expect(lambdaArgs.handler).to.have.been.calledOnce;
                const ext = lambdaArgs.handler.args[0][3];
                expect(ext).to.be.an('object');
                expect(ext.alias).to.equal(expectedAlias);
            }

            function _testEnv(alias, expectedAlias) {
                // This parameter is deprecated, but supported for backward
                // compatibility
                const wrapper = _createWrapper();
                const lambdaArgs = _initLambdaArgs(alias);
                const wrappedHandler = wrapper.wrap(lambdaArgs.handler, DEFAULT_LAMBDA_NAME);

                expect(lambdaArgs.handler).to.not.have.been.called;
                _invokeHandler(wrappedHandler, lambdaArgs);
                expect(lambdaArgs.handler).to.have.been.calledOnce;
                const ext = lambdaArgs.handler.args[0][3];
                expect(ext).to.be.an('object');
                expect(ext.env).to.equal(expectedAlias);
            }

            function _invokeHandler(wrappedHandler, lambdaArgs) {
                _consoleHelper.mute();
                const context = (new LambdaTestContext(lambdaArgs.contextProps)).context;
                wrappedHandler(lambdaArgs.event, context, lambdaArgs.callback);
                _consoleHelper.unmute();
            }

            it('should set the environment value to "" if the lambda invocation is unqualified', () => {
                // This parameter is deprecated, but supported for backward compatibility
                _testEnv(undefined, '');
            });

            it('should set the environment value to "" if the lambda invocation qualified by the "$LATEST" alias', () => {
                // This parameter is deprecated, but supported for backward compatibility
                _testEnv('$LATEST', '');
            });

            it('should set the environment value to the lambda invocation alias value', () => {
                // This parameter is deprecated, but supported for backward compatibility
                ['dev', 'stage', 'qa', 'prod', 'foo', 'bar'].forEach((env) => {
                    _testEnv(env, env);
                });
            });

            it('should set the lambda alias value to "" if the lambda invocation is unqualified', () => {
                _testAlias(undefined, '');
            });

            it('should set the lambda alias value to "" if the lambda invocation qualified by the "$LATEST" alias', () => {
                _testAlias('$LATEST', '');
            });

            it('should set the lambda alias value to the lambda invocation alias value', () => {
                ['dev', 'stage', 'qa', 'prod', 'foo', 'bar'].forEach((env) => {
                    _testAlias(env, env);
                });
            });

            it('should configure the logger with the correct parameters', () => {
                const appName = `appName_${_shortId.generate()}`;
                const lambdaName = `lambdaName_${_shortId.generate()}`;
                const alias = `alias_${_shortId.generate()}`;
                const startTime = Date.now();
                const level = 'trace';

                _lambdaConfigMock._configInstance.log = {
                    level
                };

                const wrapper = _createWrapper(appName);
                const lambdaArgs = _initLambdaArgs(alias);
                const wrappedHandler = wrapper.wrap(lambdaArgs.handler, lambdaName);

                const lambdaLoggerCtor = _lambdaLoggerMock.ctor;
                const getLoggerMethod = _lambdaLoggerMock.instance.getLogger;

                expect(lambdaLoggerCtor).to.not.have.been.called;
                expect(getLoggerMethod).to.not.have.been.called;

                _invokeHandler(wrappedHandler, lambdaArgs);

                expect(lambdaLoggerCtor).to.have.been.calledOnce;
                expect(getLoggerMethod).to.have.been.calledOnce;

                expect(lambdaLoggerCtor.args[0][0]).to.equal(appName);
                expect(lambdaLoggerCtor.args[0][1]).to.equal(level);

                expect(getLoggerMethod.args[0][0]).to.equal(lambdaName);
                expect(getLoggerMethod.args[0][1]).to.equal(alias);
                expect(getLoggerMethod.args[0][2]).to.be.within(startTime, Date.now());
            });

            it('should configure the config object with the correct parameters', () => {
                const appName = `appName_${_shortId.generate()}`;
                const lambdaName = `lambdaName_${_shortId.generate()}`;
                const alias = `alias_${_shortId.generate()}`;

                const wrapper = _createWrapper(appName);
                const lambdaArgs = _initLambdaArgs(alias);
                const wrappedHandler = wrapper.wrap(lambdaArgs.handler, lambdaName);

                const lambdaConfigCtor = _lambdaConfigMock.ctor;

                expect(lambdaConfigCtor).to.not.have.been.called;

                _invokeHandler(wrappedHandler, lambdaArgs);

                expect(lambdaConfigCtor).to.have.been.calledOnce;

                expect(lambdaConfigCtor.args[0][0]).to.equal(appName);
                expect(lambdaConfigCtor.args[0][1]).to.equal(alias);
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
                expect(execInfo.logger).to.equal(_lambdaLoggerMock._loggerInstance);
                expect(execInfo.env).to.equal(env);
                expect(execInfo.config).to.equal(_lambdaConfigMock.instance);
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
