var assert = require('assert');
var path = require('path');
var fs = require('fs');
var LangBank = require('../libs/LangBank.js');

var listCsv = __dirname+'/testdata/list_twig.csv';
var csvCode = '"","en","ja","anylang"'+"\n"+'"goodmorning","Good Morning!","おはよう！","good morning in anylang"'+"\n"+'"helloworld","Hello World","こんにちわ世界","helloworld in anylang"';

function assertLangBankError(fn, code){
	assert.throws(fn, function(e){
		assert.ok(e instanceof LangBank.LangBankError, 'LangBankError expected: '+e);
		assert.ok(e instanceof Error);
		assert.strictEqual(e.code, code);
		return true;
	});
}

describe('main Test', function() {

	it("no options", function(done) {
		this.timeout(60*1000);

		var lb = new LangBank(listCsv, function(){

			// get(), setLang()
			lb.setLang("en");
			assert.strictEqual(lb.getLang(), 'en');
			assert.strictEqual(lb.get('hello'), 'Hello');
			assert.strictEqual(lb.get('no-ja1'), 'NoJa1');
			assert.strictEqual(lb.get('no-ja2'), 'NoJa2');
			assert.strictEqual(lb.get('no-en1'), 'no-en1');
			assert.strictEqual(lb.get('undefinedKey'), 'undefinedKey');
			assert.strictEqual(lb.get('undefinedKey', 'default value'), 'default value');

			lb.setLang("ja");
			assert.strictEqual(lb.get('hello'), 'こんにちわ');
			assert.strictEqual(lb.get('no-ja1'), 'NoJa1');
			assert.strictEqual(lb.get('no-ja2'), 'NoJa2');
			assert.strictEqual(lb.get('no-en1'), 'no-en1');
			assert.strictEqual(lb.get('undefinedKey'), 'undefinedKey');
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
			listCsv,
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

				assert.strictEqual(lb.get('bind1', {"test1": "local bind test 1"}), 'test local bind test 1');
				assert.strictEqual(lb.get('bind1', {"test1": "local bind test 2"}, "test local template: {{ test1 }}"), 'test local bind test 2');
				assert.strictEqual(lb.get('undefined', {"test1": "local bind test 3"}, "test local template: {{ test1 }}"), 'test local template: local bind test 3');

				done();
			}
		);

	});

	it("as CSV code", function(done) {
		this.timeout(60*1000);

		var lb = new LangBank(
			csvCode,
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

describe('Initialize', function() {

	it("同期で初期化できる", function() {
		var lb = new LangBank(listCsv);
		assert.strictEqual(lb.get('hello'), 'Hello');
		assert.strictEqual(lb.getLang(), 'en');
		assert.strictEqual(lb.defaultLang, 'en');
	});

	it("コールバックは非同期で呼ばれる", function(done) {
		var called = false;
		var lb = new LangBank(listCsv, function(){
			called = true;
			assert.strictEqual(arguments.length, 0);
			done();
		});
		assert.strictEqual(called, false);
		assert.strictEqual(lb.get('hello'), 'Hello');
	});

	it("options だけを渡せる (コールバックなし)", function() {
		var lb = new LangBank(listCsv, {"bind": {"test1": "A"}});
		assert.strictEqual(lb.get('bind1'), 'test A');
	});

	it("第 3 引数のコールバックが null でもよい", function() {
		var lb = new LangBank(listCsv, {"bind": {"test1": "A"}}, null);
		assert.strictEqual(lb.get('bind1'), 'test A');
	});

	it("ready() は自身で resolve する Promise を返す", function() {
		var lb = new LangBank(listCsv);
		return lb.ready().then(function(result){
			assert.strictEqual(result, lb);
		});
	});

	it("null, undefined, 空文字列, 空配列は空の辞書", function() {
		[null, undefined, '', []].forEach(function(src){
			var lb = new LangBank(src);
			assert.deepStrictEqual(lb.getList(), {});
			assert.deepStrictEqual(lb.getLangList(), []);
			assert.strictEqual(lb.getLang(), null);
			assert.strictEqual(lb.get('hello'), 'hello');
			assert.strictEqual(lb.get('hello', 'default'), 'default');
		});
	});

	it("改行を含む文字列は CSV として読む (CRLF も)", function() {
		var lb = new LangBank(csvCode.replace(/\n/g, "\r\n"));
		lb.setLang('ja');
		assert.strictEqual(lb.get('helloworld'), 'こんにちわ世界');
	});

	it("BOM 付きの CSV", function() {
		var lb = new LangBank("﻿" + csvCode);
		assert.deepStrictEqual(lb.getLangList(), ['en', 'ja', 'anylang']);
		assert.strictEqual(lb.get('helloworld'), 'Hello World');
	});

	it("CR だけで改行された CSV", function() {
		var lb = new LangBank(csvCode.replace(/\n/g, "\r"));
		lb.setLang('ja');
		assert.deepStrictEqual(lb.getLangList(), ['en', 'ja', 'anylang']);
		assert.strictEqual(lb.get('helloworld'), 'こんにちわ世界');
	});

	it("パース済みの CSV 配列を渡せる", function() {
		var lb = new LangBank([["", "en", "ja"], ["k", "v", "値"]]);
		lb.setLang('ja');
		assert.strictEqual(lb.get('k'), '値');
	});

	it("読み込み元の配列を渡せる (パス, CSV 文字列, CSV 配列の混在)", function() {
		var lb = new LangBank([
			listCsv,
			'"","en"'+"\n"+'"fromString","From String"',
			[["", "en"], ["fromArray", "From Array"]]
		]);
		assert.strictEqual(lb.get('hello'), 'Hello');
		assert.strictEqual(lb.get('fromString'), 'From String');
		assert.strictEqual(lb.get('fromArray'), 'From Array');
	});

	it("load() で追加の辞書を読み込める", function() {
		var lb = new LangBank(__dirname+'/testdata/merge_a.csv');
		assert.strictEqual(lb.load(__dirname+'/testdata/merge_b.csv'), lb);
		lb.setLang('ja');
		assert.strictEqual(lb.get('hello'), 'こんにちは');
		assert.strictEqual(lb.defaultLang, 'en');
		assert.deepStrictEqual(lb.getLangList(), ['en', 'ja', 'fr']);
	});

	it("load() はデフォルト言語と現在の言語を変えない", function() {
		var lb = new LangBank(null);
		lb.load(__dirname+'/testdata/merge_b.csv');
		assert.strictEqual(lb.defaultLang, 'ja');
		assert.strictEqual(lb.getLang(), 'ja');
		lb.setLang('fr');
		lb.load(__dirname+'/testdata/merge_a.csv');
		assert.strictEqual(lb.defaultLang, 'ja');
		assert.strictEqual(lb.getLang(), 'fr');
	});

});

describe('Errors', function() {

	it("存在しないパスは FILE_NOT_FOUND", function() {
		assertLangBankError(function(){
			new LangBank(__dirname+'/testdata/typo.csv');
		}, 'FILE_NOT_FOUND');
	});

	it("コールバックを渡しても同期で throw する", function() {
		var called = false;
		assertLangBankError(function(){
			new LangBank(__dirname+'/testdata/typo.csv', function(){ called = true; });
		}, 'FILE_NOT_FOUND');
		return new Promise(function(resolve){ setTimeout(resolve, 10); }).then(function(){
			assert.strictEqual(called, false);
		});
	});

	it("改行を含まない CSV 文字列はパスとして扱う", function() {
		assertLangBankError(function(){
			new LangBank('"","en"');
		}, 'FILE_NOT_FOUND');
	});

	it("load() でも FILE_NOT_FOUND", function() {
		var lb = new LangBank(listCsv);
		assertLangBankError(function(){
			lb.load(__dirname+'/testdata/typo.csv');
		}, 'FILE_NOT_FOUND');
	});

	it("サポートしない型は INVALID_SOURCE", function() {
		[123, true, {"a": 1}].forEach(function(src){
			assertLangBankError(function(){
				new LangBank(src);
			}, 'INVALID_SOURCE');
		});
	});

	it("不正な CSV 配列は INVALID_SOURCE", function() {
		[
			[listCsv, undefined],
			[["", "en"], "row"],
			[["", "en"], ["k", ["a", "b"]]],
			[["", "en"], ["k", {"a": 1}]]
		].forEach(function(src){
			assertLangBankError(function(){
				new LangBank(src);
			}, 'INVALID_SOURCE');
		});
		var lb = new LangBank([["", "en"], null, [], ["k", 1]]);
		assert.strictEqual(lb.get('k'), '1');
	});

	it("言語の列がない CSV は INVALID_CSV", function() {
		assertLangBankError(function(){
			new LangBank('""'+"\n"+'"k"');
		}, 'INVALID_CSV');
	});

	it("CSV のパースエラーは CSV_PARSE_ERROR", function() {
		assertLangBankError(function(){
			new LangBank('"","en"'+"\n"+'"k","v');
		}, 'CSV_PARSE_ERROR');
	});

	it("Twig の構文エラーは TEMPLATE_ERROR", function() {
		var lb = new LangBank(__dirname+'/testdata/escape.csv');
		assert.throws(function(){
			lb.get('bad');
		}, function(e){
			assert.ok(e instanceof LangBank.LangBankError);
			assert.strictEqual(e.code, 'TEMPLATE_ERROR');
			assert.ok(e.message.indexOf('bad') >= 0);
			assert.ok(e.cause);
			return true;
		});
	});

});

describe('get()', function() {

	it("バインドデータが後の呼び出しに残らない", function() {
		var options = {"bind": {"test1": "global"}};
		var lb = new LangBank(listCsv, options);
		assert.strictEqual(lb.get('bind1', {"test1": "local"}), 'test local');
		assert.strictEqual(lb.get('bind1'), 'test global');
		assert.deepStrictEqual(Object.keys(options.bind), ['test1']);
	});

	it("切り離して呼んでも _ENV が使える", function() {
		var lb = new LangBank(listCsv);
		lb.setLang('ja');
		var get = lb.get;
		assert.strictEqual(get('bind2'), 'ja');
	});

	it("文字列以外のデフォルト値は指定なしとして扱う", function() {
		var lb = new LangBank(listCsv);
		assert.strictEqual(lb.get('nope', null, false), 'nope');
		assert.strictEqual(lb.get('nope', null, 0), 'nope');
		assert.strictEqual(lb.get('nope', null, null), 'nope');
	});

	it("onMissing", function() {
		var log = [];
		var lb = new LangBank(listCsv, {
			"onMissing": function(key, lang){
				log.push([key, lang]);
				return '---';
			}
		});
		lb.setLang('ja');
		assert.strictEqual(lb.get('undefinedKey'), '---');
		assert.strictEqual(lb.get('no-en1'), '---');
		assert.strictEqual(lb.get('undefinedKey', 'default'), 'default');
		assert.strictEqual(lb.get('hello'), 'こんにちわ');
		assert.deepStrictEqual(log, [['undefinedKey', 'ja'], ['no-en1', 'ja']]);
	});

	it("onMissing の戻り値は Twig で評価しない", function() {
		var lb = new LangBank(listCsv, {
			"onMissing": function(key){ return '{{ '+key+' }}'; }
		});
		assert.strictEqual(lb.get('undefinedKey'), '{{ undefinedKey }}');
	});

});

describe('Languages', function() {

	it("setLang() の戻り値", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv');
		assert.strictEqual(lb.setLang('ja'), true);
		assert.strictEqual(lb.setLang('ja_JP'), true);
		assert.strictEqual(lb.setLang('EN-us'), true);
		assert.strictEqual(lb.setLang('xx'), false);
		assert.strictEqual(lb.getLang(), 'xx');
		assert.strictEqual(lb.get('hello'), 'Hello');
	});

	it("setLang() は options.fallback も考慮する", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv', {"fallback": {"zh-HK": ["zh-Hant"]}});
		assert.strictEqual(lb.setLang('zh-HK'), true);
	});

	it("getLangList()", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv');
		assert.deepStrictEqual(lb.getLangList(), ['en', 'en-US', 'ja', 'zh-Hant', 'pt']);
	});

	it("has()", function() {
		var lb = new LangBank(listCsv);
		lb.setLang('ja');
		assert.strictEqual(lb.has('hello'), true);
		assert.strictEqual(lb.has('no-ja1'), true);
		assert.strictEqual(lb.has('no-en1'), false);
		assert.strictEqual(lb.has('undefinedKey'), false);
	});

	it("getList() はコピーを返す", function() {
		var lb = new LangBank(listCsv);
		var list = lb.getList();
		list.hello.en = 'changed';
		list.newKey = {"en": "new"};
		assert.strictEqual(lb.get('hello'), 'Hello');
		assert.strictEqual(lb.get('newKey'), 'newKey');
	});

});
