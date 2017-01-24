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
const AwsLambdaWrapper = _testHelper.AwsLambdaWrapper;

let Environment = require('../../lib/environment');

describe('Environment', () => {
    const DEFAULT_ENVIRONMENT = 'dev';
    const DEFAULT_SEPARATOR = '-';

    function _createEnvironment(envStr, envMap) {
        envStr = envStr || DEFAULT_ENVIRONMENT;
        return new Environment(envStr, envMap);
    }

    describe('ctor()', () => {
        it('should return an object with default environment values if no valid map is specified', () => {
            const env = new Environment(DEFAULT_ENVIRONMENT);

            expect(env).to.be.an('object');

            expect(env).to.have.property('env').and.to.be.a('string');
            expect(env).to.have.property('separator').and.to.be.a('string');
            expect(env).to.have.property('isValid').and.to.be.a('boolean');
            expect(env).to.have.property('token').and.to.be.a('string');
            expect(env).to.have.property('getSuffixString').and.to.be.a('function');
        });
    });

    describe('env', () => {
        it('should return undefined if a valid environment string is not specified via the constructor', () => {
            _testValueProvider.allButString('').forEach((envStr) => {
                const env = new Environment(envStr);
                expect(env.env).to.be.undefined;
            });
        });

        it('should return the environment string value specified via the constructor', () => {
            ['foo', 'bar', 'baz'].forEach((envStr) => {
                const env = new Environment(envStr);
                expect(env.env).to.equal(envStr);
            });
        });
    });

    describe('separator', () => {
        it('should return the default value if a valid string was not specified via the constructor', () => {
            _testValueProvider.allButString().forEach((separator) => {
                const env = new Environment(DEFAULT_ENVIRONMENT, undefined, separator);
                expect(env.separator).to.equal(DEFAULT_SEPARATOR);
            });
        });

        it('should return the specified value if a valid string was specified via the constructor', () => {
            ['_', '+', '|'].forEach((separator) => {
                const env = new Environment(DEFAULT_ENVIRONMENT, undefined, separator);
                expect(env.separator).to.equal(separator);
            });
        });
    });

    describe('isValid', () => {

        it('should set isValid to false if a valid environment string is not specified', () => {
            _testValueProvider.allButString('').forEach((envStr) => {
                const env = new Environment(envStr);
                expect(env.isValid).to.be.false;
            });
        });

        it('should set isValid to false if a valid environment is specified, but is not one of the default environments', () => {
            ['foo', 'bar', 'baz'].forEach((envStr) => {
                const env = new Environment(envStr);
                expect(env.isValid).to.be.false;
            });
        });

        it('should set isValid to false if a valid environment is specified, but is not present in the custom environment map', () => {
            ['dev', 'qa', 'prod'].forEach((envStr) => {
                const env = new Environment(envStr, {
                    foo: 'foo',
                    bar: 'bar',
                    baz: 'baz'
                });
                expect(env.isValid).to.be.false;
            });
        });

        it('should set isValid to true if the environment specified is one of the default environment strings', () => {
            ['dev', 'qa', 'prod'].forEach((envStr) => {
                const env = new Environment(envStr);
                expect(env.isValid).to.be.true;
            });
        });

        it('should set isValid to true if the environment specified is present in the custom environment map', () => {
            ['foo', 'bar', 'baz'].forEach((envStr) => {
                const env = new Environment(envStr, {
                    foo: 'foo',
                    bar: 'bar',
                    baz: ''
                });
                expect(env.isValid).to.be.true;
            });
        });
    });

    describe('token', () => {

        it('should return an undefined value if a valid environment string is not specified', () => {
            _testValueProvider.allButString('').forEach((envStr) => {
                const env = new Environment(envStr);
                expect(env.token).to.be.undefined;
            });
        });

        it('should return an undefined value if a valid environment is specified, but is not one of the default environments', () => {
            ['foo', 'bar', 'baz'].forEach((envStr) => {
                const env = new Environment(envStr);
                expect(env.token).to.be.undefined;
            });
        });

        it('should return an undefined value if a valid environment is specified, but is not present in the custom environment map', () => {
            ['dev', 'qa', 'prod'].forEach((envStr) => {
                const env = new Environment(envStr, {
                    foo: 'foo',
                    bar: 'bar',
                    baz: 'baz'
                });
                expect(env.token).to.be.undefined;
            });
        });

        it('should return the correct token value if the environment specified is one of the default environment strings', () => {
            ['dev', 'qa', 'prod'].forEach((envStr) => {
                const env = new Environment(envStr);
                expect(env.token).to.equal(envStr)
            });
        });

        it('should return the correct token value the environment specified is present in the custom environment map', () => {
            ['foo', 'bar', 'baz'].forEach((envStr) => {
                const customMap = {
                    foo: 'foo',
                    bar: 'bar',
                    baz: ''
                };
                const env = new Environment(envStr, customMap);
                expect(env.token).to.equal(customMap[envStr]);
            });
        });
    });

    describe('getSuffixString()', () => {
        it('should throw an error if invoked without a valid string', () => {
            const error = 'Invalid value specified (arg #1)';
            _testValueProvider.allButString().forEach((value) => {
                const wrapper = () => {
                    const env = _createEnvironment();
                    env.getSuffixString(value);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should return the original value suffixed with the environment specific suffix', () => {
            ['', 'foo', 'bar', 'baz'].forEach((value) => {
                ['dev', 'qa', 'prod'].forEach((envStr) => {
                    const env = _createEnvironment(envStr);
                    const expectedValue = `${value}${env.separator}${envStr}`;

                    expect(env.getSuffixString(value)).to.equal(expectedValue);
                });
            });
        });

        it('should return the input unchanged if the environment specific token is an empty string', () => {
            ['', 'foo', 'bar', 'baz'].forEach((value) => {
                const env = _createEnvironment('foo', {
                    foo: ''
                });

                expect(env.getSuffixString(value)).to.equal(value);
            });
        });

        it('should return an undefined value if the current environment is not valid', () => {
            ['', 'foo', 'bar', 'baz'].forEach((value) => {
                const env = _createEnvironment('bad-env');

                expect(env.getSuffixString(value)).to.be.undefined;
            });
        });
    });
});
