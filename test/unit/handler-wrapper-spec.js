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
const LambdaWrapper = _testHelper.AwsLambdaWrapper;
const _rewire = require('rewire');

let HandlerWrapper = null;

describe('HandlerWrapper', () => {
    const DEFAULT_APP_NAME = '__default_app_name__';
    const DEFAULT_LAMBDA_NAME = '__function_name__';
    const DEFAULT_HANDLER = () => {};

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
                const testWrapper = () => {
                    return new HandlerWrapper(appName);
                };
                expect(testWrapper).to.throw(error);
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
                const testWrapper = () => {
                    const wrapper = new HandlerWrapper(DEFAULT_APP_NAME);
                    wrapper.wrap(handler);
                };
                expect(testWrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid handler', () => {
            const error = 'Invalid lambda function name specified (arg #2)';
            _testValueProvider.allButString('').forEach((lambdaName) => {
                const testWrapper = () => {
                    const wrapper = new HandlerWrapper(DEFAULT_APP_NAME);
                    wrapper.wrap(DEFAULT_HANDLER, lambdaName);
                };
                expect(testWrapper).to.throw(error);
            });
        });

        it('should return a function when invoked', () => {
            const wrapper = _createWrapper();
            const handler = wrapper.wrap(DEFAULT_HANDLER, DEFAULT_LAMBDA_NAME);

            expect(handler).to.be.a('function');
        });

        describe('[wrapper behavior]', () => {
            let _loggerProviderMock = null;

            function _initTestWrapper(alias) {
                const handler = _sinon.spy();
                const testWrapper = new LambdaWrapper(handler, {}, {
                    alias: alias
                });

                return testWrapper;
            }

            function _testEnv(alias, env) {
                env = env || alias;

                const wrapper = _createWrapper();
                const testWrapper = _initTestWrapper(alias);
                const handler = wrapper.wrap(testWrapper.handler, DEFAULT_LAMBDA_NAME);

                process.env.NODE_ENV = '';
                _invokeHandler(handler, testWrapper);
                expect(process.env.NODE_ENV).to.equal(env);
            }

            function _invokeHandler(handler, testWrapper) {
                _consoleHelper.mute();
                handler(testWrapper.event, testWrapper.context, testWrapper.callback);
                _consoleHelper.unmute();
            }

            beforeEach(() => {
                //Initialize the config module so that tests don't result in 
                //warning messages.
                const config = require('config');

                _loggerProviderMock = {
                    configure: _sinon.spy(),
                    getLogger: () => {},
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
                const testWrapper = _initTestWrapper(env);
                const handler = wrapper.wrap(testWrapper.handler, lambdaName);

                expect(_loggerProviderMock.configure).to.not.have.been.called;
                expect(_loggerProviderMock.getLogger).to.not.have.been.called;

                _invokeHandler(handler, testWrapper);

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
            });

            it('should invoke the handler after configuration is complete', () => {
                const wrapper = _createWrapper();
                const testWrapper = _initTestWrapper();
                const actualHandler = _sinon.spy();
                const handler = wrapper.wrap(actualHandler, DEFAULT_LAMBDA_NAME);

                expect(actualHandler).to.not.have.been.called;

                _invokeHandler(handler, testWrapper);

                expect(actualHandler).to.have.been.calledOnce;
                expect(actualHandler.args[0][0]).to.equal(testWrapper.event);
                expect(actualHandler.args[0][1]).to.equal(testWrapper.context);
                expect(actualHandler.args[0][2]).to.equal(testWrapper.callback);
            });

            it('should include logger, env and config as an additional argument to the handler', () => {
                const env = 'foo';
                const wrapper = _createWrapper();
                const testWrapper = _initTestWrapper(env);
                const actualHandler = _sinon.spy();
                const handler = wrapper.wrap(actualHandler, DEFAULT_LAMBDA_NAME);

                expect(actualHandler).to.not.have.been.called;

                _invokeHandler(handler, testWrapper);

                expect(actualHandler).to.have.been.calledOnce;
                const execInfo = actualHandler.args[0][3];
                expect(execInfo).to.be.an('object');
                expect(execInfo.logger).to.equal(_loggerProviderMock._logger);
                expect(execInfo.env).to.equal(env);
                expect(execInfo.config).to.equal(require('config'));
            });
        });
    });
});
