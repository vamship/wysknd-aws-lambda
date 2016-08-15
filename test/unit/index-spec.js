/* jshint node:true, expr:true */
'use strict';

var _sinon = require('sinon');
var _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
var expect = _chai.expect;

var _index = require('../../lib/index');

describe('index', function() {
    it('should implement methods required by the interface', function() {
        expect(_index.HandlerWrapper).to.be.a('function');
    });

    it('should return the correct class for HandlerWrapper', function() {
        expect(_index.HandlerWrapper).to.equal(require('../../lib/handler-wrapper'));
    });
});
