var assert = require('assert');
var path = require('path');
var fs = require('fs');
var LangBank = require('../libs/main.js');

describe('main Test', function() {

	it("no options", function(done) {
		this.timeout(60*1000);

		var lb = new LangBank(__dirname+'/testdata/list_twig.csv', function(){

			// get(), setLang()
			lb.setLang("en");
			assert.strictEqual(lb.getLang(), 'en');
			assert.strictEqual(lb.get('hello'), 'Hello');
			assert.strictEqual(lb.get('no-ja1'), 'NoJa1');
			assert.strictEqual(lb.get('no-ja2'), 'NoJa2');
			assert.strictEqual(lb.get('no-en1'), '---');
			assert.strictEqual(lb.get('undefinedKey'), '---');
			assert.strictEqual(lb.get('undefinedKey', 'default value'), 'default value');

			lb.setLang("ja");
			assert.strictEqual(lb.get('hello'), 'こんにちわ');
			assert.strictEqual(lb.get('no-ja1'), 'NoJa1');
			assert.strictEqual(lb.get('no-ja2'), 'NoJa2');
			assert.strictEqual(lb.get('no-en1'), '---');
			assert.strictEqual(lb.get('undefinedKey'), '---');
			assert.strictEqual(lb.get('undefinedKey', 'default value'), 'default value');

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
			__dirname+'/testdata/list_twig.csv',
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

	it("as CSV code", function(done) {
		this.timeout(60*1000);

		var lb = new LangBank(
			'"","en","ja","anylang"'+"\n"+'"goodmorning","Good Morning!","おはよう！","good morning in anylang"'+"\n"+'"helloworld","Hello World","こんにちわ世界","helloworld in anylang"',
			function(){

				lb.setLang("en");
				assert.strictEqual(lb.get('helloworld'), 'Hello World');

				lb.setLang("ja");
				assert.strictEqual(lb.get('helloworld'), 'こんにちわ世界');

				assert.strictEqual(lb.getList().helloworld.ja, 'こんにちわ世界');
				assert.strictEqual(lb.getList().helloworld.en, 'Hello World');

				done();
			}
		);

	});

	it("null or undefined", function(done) {
		this.timeout(60*1000);

		var lb = new LangBank(
			null,
			function(){
				assert.strictEqual(lb.get('helloworld', 'undefined'), 'undefined');
				done();
			}
		);

	});

});
