var assert = require('assert');
var path = require('path');
var fs = require('fs');
var Promise = require("es6-promise").Promise;
var LangBank = require('../libs/main.js');

describe('main Test', function() {

	it("no options", function(done) {
		this.timeout(60*1000);

		var lb = new LangBank(__dirname+'/testdata/list.csv', function(){

			lb.setLang("en");
			assert.equal(lb.get('hello'), 'Hello');

			lb.setLang("ja");
			assert.equal(lb.get('hello'), 'こんにちわ');

			assert.equal(lb.getList().hello.ja, 'こんにちわ');
			assert.equal(lb.getList().hello.en, 'Hello');

			done();
		});

	});

	it("options", function(done) {
		this.timeout(60*1000);

		var lb = new LangBank(
			__dirname+'/testdata/list.csv',
			{},
			function(){

				lb.setLang("en");
				assert.equal(lb.get('hello'), 'Hello');

				lb.setLang("ja");
				assert.equal(lb.get('hello'), 'こんにちわ');

				assert.equal(lb.getList().hello.ja, 'こんにちわ');
				assert.equal(lb.getList().hello.en, 'Hello');

				done();
			}
		);

	});

});
