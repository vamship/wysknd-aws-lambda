/* jshint node:true, expr:true */
'use strict';

const _shortId = require('shortid');
const _rewire = require('rewire');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const _sinon = require('sinon');
const expect = _chai.expect;

const _testHelper = require('wysknd-test');
const _testValueProvider = _testHelper.testValueProvider;
const ObjectMock = _testHelper.ObjectMock;

let LambdaLogger = null;

describe('LambdaLogger', () => {
    let _loggerProviderMock = null;

    function _createLogger(appName, logLevel) {
        appName = appName || `appName_${_shortId.generate()}`;
        logLevel = logLevel || 'info';

        return new LambdaLogger(appName, logLevel);
    }

    beforeEach(() => {
        const loggerInstance = {
            trace: _sinon.spy(),
            debug: _sinon.spy(),
            info: _sinon.spy(),
            warn: _sinon.spy(),
            error: _sinon.spy(),
            fatal: _sinon.spy()
        };
        _loggerProviderMock = (new ObjectMock())
            .addMock('configure', undefined, true)
            .addMock('getLogger', loggerInstance, true);

        _loggerProviderMock._loggerInstance = loggerInstance;

        LambdaLogger = _rewire('../../lib/lambda-logger');
        LambdaLogger.__set__('_loggerProvider', _loggerProviderMock.instance);
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid appName', () => {
            const error = 'Invalid appName specified (arg #1)';
            _testValueProvider.allButString('').forEach((appName) => {
                const wrapper = () => {
                    return new LambdaLogger(appName);
                };
                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid logLevel', () => {
            const error = 'Invalid logLevel specified (arg #2)';
            _testValueProvider.allButString('').forEach((logLevel) => {
                const wrapper = () => {
                    const appName = `appName_${_shortId.generate()}`;
                    return new LambdaLogger(appName, logLevel);
                };
                expect(wrapper).to.throw(error);
            });
        });

        it('should expose the expected methods and properties', () => {
            const appName = `appName_${_shortId.generate()}`;
            const logLevel = 'info';
            const logger = new LambdaLogger(appName, logLevel);

            expect(logger).to.be.an('object');
            expect(logger.getLogger).to.be.a('function');
        });

        it('should configure the logger provider with the correct app name and log level', () => {
            const appName = `appName_${_shortId.generate()}`;
            const logLevel = 'trace';
            const configureMethod = _loggerProviderMock.instance.configure;

            expect(configureMethod).to.not.have.been.called;

            new LambdaLogger(appName, logLevel);

            expect(configureMethod).to.have.been.calledOnce;

            const loggerProviderCfg = configureMethod.args[0][0];
            expect(loggerProviderCfg).to.be.an('object');
            expect(loggerProviderCfg.appName).to.equal(appName);
            expect(loggerProviderCfg.logLevel).to.equal(logLevel);
        });
    });

    describe('getLogger()', () => {
        function _getLoggerInstance(lambdaName, alias, startTime) {
            lambdaName = lambdaName || `lambdaName_${_shortId.generate()}`;
            alias = alias || `alias_${_shortId.generate()}`;
            startTime = startTime || Date.now();

            const logger = _createLogger();
            return logger.getLogger(lambdaName, alias, startTime);
        }

        it('should throw an error if invoked without a valid lambdaName', () => {
            const error = 'Invalid lambdaName specified (arg #1)';
            _testValueProvider.allButString('').forEach((lambdaName) => {
                const wrapper = () => {
                    const logger = _createLogger();
                    return logger.getLogger(lambdaName);
                };
                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid alias', () => {
            const error = 'Invalid alias specified (arg #2)';
            _testValueProvider.allButString().forEach((alias) => {
                const wrapper = () => {
                    const logger = _createLogger();
                    const lambdaName = `lambdaName_${_shortId.generate()}`;
                    return logger.getLogger(lambdaName, alias);
                };
                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid startTime', () => {
            const error = 'Invalid startTime specified (arg #3)';
            _testValueProvider.allButNumber(-1).forEach((startTime) => {
                const wrapper = () => {
                    const logger = _createLogger();
                    const lambdaName = `lambdaName_${_shortId.generate()}`;
                    const alias = `alias_${_shortId.generate()}`;
                    return logger.getLogger(lambdaName, alias, startTime);
                };
                expect(wrapper).to.throw(error);
            });
        });

        it('should initialize and return a logger object with appropriate meta properties when invoked', () => {
            const logger = _createLogger();
            const getLoggerMethod = _loggerProviderMock.instance.getLogger;

            const lambdaName = `lambdaName_${_shortId.generate()}`;
            const alias = `alias_${_shortId.generate()}`;
            const startTime = Date.now();

            expect(getLoggerMethod).to.not.have.been.called;

            const loggerInstance = logger.getLogger(lambdaName, alias, startTime);
            expect(getLoggerMethod).to.have.been.calledOnce;
            expect(loggerInstance).to.equal(_loggerProviderMock._loggerInstance);

            expect(getLoggerMethod.args[0][0]).to.equal(lambdaName);

            const loggerProps = getLoggerMethod.args[0][1];
            expect(loggerProps).to.be.an('object');
            expect(loggerProps.env).to.equal(alias);
            expect(loggerProps.alias).to.equal(alias);
            expect(loggerProps.executionId).to.be.a('string').and.to.not.be.empty;
        });

        describe('[special logger methods]', () => {
            it('should inject appropriate special methods into the logger object', () => {
                const loggerInstance = _getLoggerInstance();
                expect(loggerInstance.metrics).to.be.a('function');
                expect(loggerInstance.timespan).to.be.a('function');
            });

            describe('metrics()', () => {
                it('should invoke the logger.info method with a metrics description object when invoked', () => {
                    const logger = _getLoggerInstance();
                    const infoMethod = logger.info;

                    const metric = _shortId.generate();
                    const value = _shortId.generate();
                    const props = {
                        prop1: _shortId.generate(),
                        prop2: _shortId.generate()
                    };
                    infoMethod.reset();
                    logger.metrics(metric, value, props);

                    expect(infoMethod).to.have.been.calledOnce;
                    expect(infoMethod.args[0][0]).to.be.an('object');
                    expect(infoMethod.args[0][0]).to.deep.equal({
                        metric,
                        value,
                        prop1: props.prop1,
                        prop2: props.prop2
                    });
                });
            });

            describe('timespan()', () => {
                it('should invoke the logger.info method with a timespan specific metrics description object when invoked', () => {
                    const logger = _getLoggerInstance();
                    const infoMethod = logger.info;

                    const metric = _shortId.generate();
                    const startTime = Date.now();
                    const props = {
                        prop1: _shortId.generate(),
                        prop2: _shortId.generate()
                    };
                    infoMethod.reset();

                    const minDelta = Date.now() - startTime;
                    logger.timespan(metric, startTime, props);
                    const maxDelta = Date.now() - startTime;

                    expect(infoMethod).to.have.been.calledOnce;
                    expect(infoMethod.args[0][0]).to.be.an('object');
                    expect(infoMethod.args[0][0].metric).to.equal(metric);
                    expect(infoMethod.args[0][0].value).to.be.within(minDelta, maxDelta);
                    expect(infoMethod.args[0][0].prop1).to.equal(props.prop1);
                    expect(infoMethod.args[0][0].prop2).to.equal(props.prop2);
                });

                it('should use the lambda start time if the startTime parameter is omitted', () => {
                    const startTime = Date.now();

                    const minDelta = Date.now() - startTime;
                    const logger = _getLoggerInstance();
                    const infoMethod = logger.info;

                    const metric = _shortId.generate();
                    infoMethod.reset();

                    logger.timespan(metric);
                    const maxDelta = Date.now() - startTime;

                    expect(infoMethod).to.have.been.calledOnce;
                    expect(infoMethod.args[0][0]).to.be.an('object');
                    expect(infoMethod.args[0][0].value).to.be.within(minDelta, maxDelta);
                });
            });
        });

    });
});
