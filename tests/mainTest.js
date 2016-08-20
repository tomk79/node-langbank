var assert = require('assert');
var path = require('path');
var fs = require('fs');
var Promise = require("es6-promise").Promise;
var LangBank = require('../libs/main.js');

describe('main Test', function() {

	it("no options", function(done) {
		this.timeout(60*1000);

		var lb = new LangBank(__dirname+'/testdata/list.csv', function(){

			// get(), setLang()
			lb.setLang("en");
			assert.strictEqual(lb.get('hello'), 'Hello');
			assert.strictEqual(lb.get('no-ja1'), 'NoJa1');
			assert.strictEqual(lb.get('no-ja2'), 'NoJa2');
			assert.strictEqual(lb.get('no-en1'), '---');
			assert.strictEqual(lb.get('undefinedKey'), '---');

			lb.setLang("ja");
			assert.strictEqual(lb.get('hello'), 'こんにちわ');
			assert.strictEqual(lb.get('no-ja1'), 'NoJa1');
			assert.strictEqual(lb.get('no-ja2'), 'NoJa2');
			assert.strictEqual(lb.get('no-en1'), '---');
			assert.strictEqual(lb.get('undefinedKey'), '---');

			lb.setLang("anylang");
			assert.strictEqual(lb.get('goodmorning'), 'good morning in anylang');
			assert.strictEqual(lb.get('hello'), 'hello in anylang');

			// getList()
			assert.strictEqual(lb.getList().hello.ja, 'こんにちわ');
			assert.strictEqual(lb.getList().hello.en, 'Hello');

			done();
		});

	});

	it("options", function(done) {
		this.timeout(60*1000);

		var lb = new LangBank(
			__dirname+'/testdata/list.csv',
			{
				"bind":{
					"test1": "bind test 1",
					"test2": "bind test 2"
				}
			},
			function(){

				lb.setLang("en");
				assert.strictEqual(lb.get('hello'), 'Hello');

				lb.setLang("ja");
				assert.strictEqual(lb.get('hello'), 'こんにちわ');

				assert.strictEqual(lb.getList().hello.ja, 'こんにちわ');
				assert.strictEqual(lb.getList().hello.en, 'Hello');

				// bind test
				assert.strictEqual(lb.get('bind1'), 'test bind test 1');
				assert.strictEqual(lb.get('bind2'), 'ja');
				assert.strictEqual(lb.get('bind3'), 'en');
				assert.strictEqual(lb.get('bind4'), 'こんにちわ');

				done();
			}
		);

	});

});
