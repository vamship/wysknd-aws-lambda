/* jshint node:true, expr:true */
'use strict';

const _shortId = require('shortid');
const _rewire = require('rewire');
const _dp = require('dot-prop');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _testHelper = require('wysknd-test');
const _testValueProvider = _testHelper.testValueProvider;
const ObjectMock = _testHelper.ObjectMock;

let LambdaConfig = null;

describe('LambdaConfig', () => {
    let _rcMock = null;
    let _dpMock = null;

    function _createConfig(appName, alias) {
        appName = appName || `appName_${_shortId.generate()}`;
        alias = alias || `alias_${_shortId.generate()}`;

        return new LambdaConfig(appName, alias);
    }

    beforeEach(() => {
        const configInstance = {
            prop1: `prop1_${_shortId.generate()}`,
            prop2: Math.floor(Math.random() * 100)
        };
        _rcMock = (new ObjectMock()).addMock('_init', () => {
            return configInstance;
        }, true);
        _rcMock._configInstance = configInstance;

        _dpMock = (new ObjectMock())
            .addMock('get', (config, key) => {
                return _dp.get(config, key);
            }, true).addMock('has', (config, key) => {
            return _dp.has(config, key);
        }, true);

        LambdaConfig = _rewire('../../lib/lambda-config');
        LambdaConfig.__set__('_rc', _rcMock.instance._init);
        LambdaConfig.__set__('_dp', _dpMock.instance);
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid appName', () => {
            const error = 'Invalid appName specified (arg #1)';
            _testValueProvider.allButString('').forEach((appName) => {
                const wrapper = () => {
                    return new LambdaConfig(appName);
                };
                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid alias', () => {
            const error = 'Invalid alias specified (arg #2)';
            _testValueProvider.allButString('').forEach((alias) => {
                const wrapper = () => {
                    const appName = `appName_${_shortId.generate()}`;
                    return new LambdaConfig(appName, alias);
                };
                expect(wrapper).to.throw(error);
            });
        });

        it('should expose the expected methods and properties', () => {
            const appName = `appName_${_shortId.generate()}`;
            const alias = `alias_${_shortId.generate()}`;
            const config = new LambdaConfig(appName, alias);

            expect(config).to.be.an('object');
            expect(config.get).to.be.a('function');
        });

        it('should initialize the config object using the correct app name', () => {
            const appName = `appName_${_shortId.generate()}`;
            const configureMethod = _rcMock.instance._init;

            expect(configureMethod).to.not.have.been.called;

            _createConfig(appName);

            expect(configureMethod).to.have.been.calledOnce;

            expect(configureMethod.args[0][0]).to.equal(appName);

            const defaultProps = configureMethod.args[0][1];
            expect(defaultProps).to.be.an('object');
            expect(defaultProps).to.deep.equal({
                log: {
                    level: 'info'
                }
            });
        });
    });

    describe('get', () => {
        it('should return undefined if the key is not a valid non empty string', () => {
            const config = _createConfig();
            expect(_dpMock.instance.get).to.not.have.been.called;
            _testValueProvider.allButString('').forEach((key) => {
                expect(config.get(key)).to.be.undefined;
                expect(_dpMock.instance.get).to.not.have.been.called;
            });
        });

        it('should return undefined if the key does not correspond to an existing config property', () => {
            const alias = `alias_${_shortId.generate()}`;
            const config = _createConfig(undefined, alias);
            expect(_dpMock.instance.get).to.not.have.been.called;
            expect(_dpMock.instance.has).to.not.have.been.called;
            [
                `key_${_shortId.generate()}`,
                `key_${_shortId.generate()}`,
                `key_${_shortId.generate()}`,
                `key_${_shortId.generate()}`,
                `key_${_shortId.generate()}`
            ].forEach((key) => {
                expect(config.get(key)).to.be.undefined;
                expect(_dpMock.instance.get).to.not.have.been.called;
                expect(_dpMock.instance.has).to.have.been.calledOnce;
                expect(_dpMock.instance.has.args[0][0]).to.equal(_rcMock._configInstance);
                expect(_dpMock.instance.has.args[0][1]).to.equal(`${alias}.${key}`);
                _dpMock.instance.has.reset();
            });
        });

        it('should use the dot-prop library to lookup and return the appropriate config value', () => {
            const alias = `alias_${_shortId.generate()}`;
            const config = _createConfig(undefined, alias);

            function computeConfigValue(key) {
                return `${key}_value`;
            }
            const keys = [
                `key_${_shortId.generate()}`,
                `key_${_shortId.generate()}`,
                `key_${_shortId.generate()}`,
                `key_${_shortId.generate()}`,
                `key_${_shortId.generate()}`
            ];
            _rcMock._configInstance[alias] = {};
            keys.forEach((key) => {
                _rcMock._configInstance[alias][key] = computeConfigValue(key);
            });

            expect(_dpMock.instance.get).to.not.have.been.called;
            expect(_dpMock.instance.has).to.not.have.been.called;
            keys.forEach((key) => {
                expect(config.get(key)).to.equal(computeConfigValue(key));
                expect(_dpMock.instance.get).to.have.been.calledOnce;
                expect(_dpMock.instance.has).to.have.been.calledOnce;
                expect(_dpMock.instance.get.args[0][0]).to.equal(_rcMock._configInstance);
                expect(_dpMock.instance.get.args[0][1]).to.equal(`${alias}.${key}`);
                _dpMock.instance.has.reset();
                _dpMock.instance.get.reset();
            });
        });
    });
});
