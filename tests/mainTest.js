var assert = require('assert');
var path = require('path');
var fs = require('fs');
var LangBank = require('../libs/LangBank.js');

var listCsv = __dirname+'/testdata/list.csv';
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

	it("no options", function() {
		var lb = new LangBank(listCsv);

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
	});

	it("options", function() {
		var lb = new LangBank(listCsv, {
			"bind":{
				"test1": "bind test 1",
				"test2": "bind test 2"
			}
		});

		lb.setLang("en");
		assert.strictEqual(lb.get('hello'), 'Hello');

		lb.setLang("ja");
		assert.strictEqual(lb.get('hello'), 'こんにちわ');

		assert.strictEqual(lb.getList().hello.ja, 'こんにちわ');
		assert.strictEqual(lb.getList().hello.en, 'Hello');

		// bind test
		assert.strictEqual(lb.get('bind1'), 'test bind test 1');
		assert.strictEqual(lb.get('bind1', {"test1": "local bind test 1"}), 'test local bind test 1');
		assert.strictEqual(lb.get('bind1', {"test1": "local bind test 2"}, "test local template: {{ test1 }}"), 'test local bind test 2');
		assert.strictEqual(lb.get('undefined', {"test1": "local bind test 3"}, "test local template: {{ test1 }}"), 'test local template: local bind test 3');
	});

	it("as CSV code", function() {
		var lb = new LangBank(csvCode);

		lb.setLang("en");
		assert.strictEqual(lb.get('helloworld'), 'Hello World');

		lb.setLang("ja");
		assert.strictEqual(lb.get('helloworld'), 'こんにちわ世界');

		assert.strictEqual(lb.getList().helloworld.ja, 'こんにちわ世界');
		assert.strictEqual(lb.getList().helloworld.en, 'Hello World');
	});

	it("null or undefined", function() {
		var lb = new LangBank(null);
		assert.strictEqual(lb.get('helloworld', 'undefined'), 'undefined');
	});

});

describe('Initialize', function() {

	it("同期で初期化できる", function() {
		var lb = new LangBank(listCsv);
		assert.strictEqual(lb.get('hello'), 'Hello');
		assert.strictEqual(lb.getLang(), 'en');
		assert.strictEqual(lb.defaultLang, 'en');
	});

	it("コールバックは廃止した (第 3 引数は TypeError)", function() {
		[function(){}, null, false].forEach(function(callback){
			assert.throws(function(){
				new LangBank(listCsv, {}, callback);
			}, function(e){
				return e instanceof TypeError && /callback was removed/.test(e.message);
			});
		});
		// 第 2 引数の関数 (v1 のコールバック) は、オプションの型の誤り
		assert.throws(function(){
			new LangBank(listCsv, function(){});
		}, TypeError);
		// undefined は省略と同じ
		assert.strictEqual(new LangBank(listCsv, undefined, undefined).get('hello'), 'Hello');
	});

	it("options だけを渡せる", function() {
		var lb = new LangBank(listCsv, {"bind": {"test1": "A"}});
		assert.strictEqual(lb.get('bind1'), 'test A');
	});

	it("ready() はない", function() {
		var lb = new LangBank(listCsv);
		assert.strictEqual(typeof(lb.ready), 'undefined');
	});

	it("読み込み元は省略できる", function() {
		var lb = new LangBank();
		assert.deepStrictEqual(lb.getLangList(), []);
		lb.load(listCsv);
		assert.strictEqual(lb.getLang(), 'en');
		assert.strictEqual(lb.get('hello'), 'Hello');
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
			[listCsv, undefined, 1],
			[["", "en"], "row"],
			[["", "en"], ["k", ["a", "b"]]],
			[["", "en"], ["k", {"a": 1}]],
			[["", "en"], ["k", function(){}]]
		].concat(
			typeof(Symbol) === 'function' ? [[["", "en"], ["k", Symbol('s')]]] : [],
			typeof(BigInt) === 'function' ? [[["", "en"], ["k", BigInt(1)]]] : []
		).forEach(function(src){
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

	it("不正な CSV でもエラーにしない (PHP版と同じ規則で読む)", function() {
		var lb = new LangBank('"","en"'+"\n"+'"k","v'+"\n"+'"k2","v2"');
		assert.deepStrictEqual(lb.getList(), {"k": {"en": 'v\nk2"'}});
		lb = new LangBank('"","en"'+"\n"+'"a","x"y'+"\n"+'"b",x"y'+"\n");
		assert.strictEqual(lb.get('a'), 'xy');
		assert.strictEqual(lb.get('b'), 'x"y');
	});

	it("予約した構文は読み込み時に TEMPLATE_ERROR", function() {
		assert.throws(function(){
			new LangBank('"","en","ja"'+"\n"+'"ok","OK",""'+"\n"+'"bad","OK","{% if x %}"'+"\n");
		}, function(e){
			assert.ok(e instanceof LangBank.LangBankError);
			assert.strictEqual(e.code, 'TEMPLATE_ERROR');
			assert.strictEqual(e.message, 'Unsupported syntax in the word of key "bad" (lang: ja): "{% if x %}". Only placeholders like {{ name }} are supported.');
			return true;
		});
		var lb = new LangBank(listCsv);
		assertLangBankError(function(){
			lb.load([["", "en"], ["bad", "{{ a.b }}"]]);
		}, 'TEMPLATE_ERROR');
		assert.strictEqual(lb.has('bad'), false);
	});

	it("予約した構文のデフォルト値は get() で TEMPLATE_ERROR", function() {
		var lb = new LangBank(listCsv);
		lb.setLang('ja');
		assert.throws(function(){
			lb.get('nokey', {"name": "x"}, '{# comment #}');
		}, function(e){
			assert.ok(e instanceof LangBank.LangBankError);
			assert.strictEqual(e.code, 'TEMPLATE_ERROR');
			assert.strictEqual(e.message, 'Unsupported syntax in the default value of key "nokey" (lang: ja): "{# comment #}". Only placeholders like {{ name }} are supported.');
			return true;
		});
		// 訳文があれば、デフォルト値は使わない (調べない)
		assert.strictEqual(lb.get('hello', null, '{% x %}'), 'こんにちわ');
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

	it("切り離して呼べる", function() {
		var lb = new LangBank(listCsv, {"bind": {"test1": "A"}});
		lb.setLang('ja');
		var get = lb.get;
		assert.strictEqual(get('hello'), 'こんにちわ');
		assert.strictEqual(get('bind1'), 'test A');
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

	it("onMissing が文字列以外を返したらキーを返す", function() {
		[undefined, null, false, 0, {}].forEach(function(ret){
			var lb = new LangBank(listCsv, {
				"onMissing": function(){ return ret; }
			});
			assert.strictEqual(lb.get('undefinedKey'), 'undefinedKey');
		});
		var lb = new LangBank(listCsv, {
			"onMissing": function(){ return ''; }
		});
		assert.strictEqual(lb.get('undefinedKey'), '');
	});

	it("onMissing の戻り値は置き換えない", function() {
		var lb = new LangBank(listCsv, {
			"onMissing": function(key){ return '{{ '+key+' }} {% x %}'; }
		});
		assert.strictEqual(lb.get('undefinedKey', {"undefinedKey": "X"}), '{{ undefinedKey }} {% x %}');
	});

	it("onMissing が投げた例外は、そのまま投げる", function() {
		var boom = new Error('boom');
		var lb = new LangBank(listCsv, {"onMissing": function(){ throw boom; }});
		assert.throws(function(){ lb.get('nokey'); }, function(e){ return e === boom; });
	});

	it("バインドデータは、自身の列挙可能なプロパティだけを探す", function() {
		var lb = new LangBank('"","en"'+"\n"+'"k","[{{ x }}][{{ length }}][{{ constructor }}][{{ toString }}]"'+"\n");
		assert.strictEqual(lb.get('k', Object.create({"x": "inherited"})), '[][][][]');
		assert.strictEqual(lb.get('k', ['a', 'b']), '[][][][]');
		var data = {};
		Object.defineProperty(data, 'x', {"value": "hidden", "enumerable": false});
		assert.strictEqual(lb.get('k', data), '[][][][]');
		assert.strictEqual(lb.get('k', {"x": "own", "length": 2}), '[own][2][][]');
		assert.strictEqual(lb.get('k', {get x(){ return 'getter'; }}), '[getter][][][]');

		// options.bind も同じ (自身の列挙可能なプロパティだけをコピーする)
		lb = new LangBank('"","en"'+"\n"+'"k","[{{ x }}][{{ y }}]"'+"\n", {"bind": Object.assign(Object.create({"x": "inherited"}), {"y": "own"})});
		assert.strictEqual(lb.get('k'), '[][own]');
	});

	it("値の型が対応していなければ TEMPLATE_ERROR", function() {
		var lb = new LangBank('"","en"'+"\n"+'"k","[{{ x }}]"'+"\n");
		[{}, [], function(){}].concat(typeof(Symbol) === 'function' ? [Symbol('s')] : []).forEach(function(value){
			assert.throws(function(){
				lb.get('k', {"x": value});
			}, function(e){
				assert.ok(e instanceof LangBank.LangBankError);
				assert.strictEqual(e.code, 'TEMPLATE_ERROR');
				assert.ok(/Unsupported type of the value "x"/.test(e.message), e.message);
				return true;
			});
		});
		// 数値は String() と同じ
		assert.strictEqual(lb.get('k', {"x": 0.1 + 0.2}), '[0.30000000000000004]');
		assert.strictEqual(lb.get('k', {"x": undefined}), '[]');
		// options.bind の値は、使うときに調べる
		lb = new LangBank('"","en"'+"\n"+'"k","[{{ x }}]"'+"\n"+'"other","[{{ y }}]"'+"\n", {"bind": {"x": {}}});
		assert.strictEqual(lb.get('other'), '[]');
		assertLangBankError(function(){ lb.get('k'); }, 'TEMPLATE_ERROR');
	});

	it("getList() と has() は訳文をそのまま扱う", function() {
		var lb = new LangBank(__dirname+'/testdata/placeholders.csv');
		assert.strictEqual(lb.getList().greet.en, 'Hi {{ name }}');
		assert.strictEqual(lb.has('greet'), true);
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

	it("getLangList() は表記の揺れを最初の表記にまとめる", function() {
		var lb = new LangBank([__dirname+'/testdata/header_case_a.csv', __dirname+'/testdata/header_case_b.csv']);
		assert.deepStrictEqual(lb.getLangList(), ['en', 'ja_JP']);
		assert.deepStrictEqual(lb.getList().bye, {"en": "Bye", "ja_JP": "さようなら"});
	});

	it("getDefaultLang()", function() {
		var lb = new LangBank(null);
		assert.strictEqual(lb.getDefaultLang(), null);
		lb.load(__dirname+'/testdata/regional.csv');
		lb.setLang('ja');
		assert.strictEqual(lb.getDefaultLang(), 'en');
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

describe('Interface', function() {

	it("get() はラッパー関数から引数をそのまま渡せる", function() {
		var lb = new LangBank(listCsv);
		function t(key, a, b){
			return lb.get(key, a, b);
		}
		assert.strictEqual(t('undefinedKey', 'DEF'), 'DEF');
		assert.strictEqual(t('undefinedKey', 'DEF', null), 'DEF');
		assert.strictEqual(t('bind1', {"test1": "x"}), 'test x');
		assert.strictEqual(t('undefinedKey', null, 'D'), 'D');
		assert.strictEqual(t('hello'), 'Hello');
	});

	it("不正なオプションは INVALID_OPTION", function() {
		[
			{"unknown": 1},
			{"onmissing": function(){}},
			{"bind": "x"},
			{"bind": []},
			{"template": "false"},
			{"template": 0},
			{"twig": false},
			{"autoescape": "html"},
			{"autoescape": false},
			{"onMissing": "f"},
			{"fallback": []},
			{"fallback": {"ja": 1}},
			{"fallback": {"ja": ["en", 1]}}
		].forEach(function(options){
			assertLangBankError(function(){
				new LangBank(listCsv, options);
			}, 'INVALID_OPTION');
		});
		assert.throws(function(){
			new LangBank(listCsv, {"onmissing": function(){}});
		}, /onmissing/);
	});

	it("オブジェクト以外のオプションは TypeError", function() {
		['x', 1, true, []].forEach(function(options){
			assert.throws(function(){
				new LangBank(listCsv, options);
			}, function(e){
				return e instanceof TypeError && !(e instanceof LangBank.LangBankError);
			});
		});
		var lb = new LangBank(listCsv);
		var view = lb.withLang('en');
		['x', 1, true, [], function(){}].forEach(function(options){
			assert.throws(function(){ lb.has('hello', options); }, TypeError);
			assert.throws(function(){ view.has('hello', options); }, TypeError);
		});
		[null, undefined].forEach(function(options){
			assert.strictEqual(lb.has('hello', options), true);
			assert.strictEqual(view.has('hello', options), true);
			assert.strictEqual(new LangBank(listCsv, options).get('hello'), 'Hello');
		});

		// 関数も TypeError (v1 のコールバック)
		assert.throws(function(){
			new LangBank(listCsv, function(){});
		}, function(e){
			return e instanceof TypeError && !(e instanceof LangBank.LangBankError);
		});
	});

	it("null や undefined のオプションは指定なしとして扱う", function() {
		var lb = new LangBank(listCsv, {"bind": null, "template": undefined, "onMissing": null, "fallback": null});
		assert.strictEqual(lb.get('undefinedKey'), 'undefinedKey');
		lb = new LangBank(listCsv, null);
		assert.strictEqual(lb.get('hello'), 'Hello');
	});

	it("template: true は既定と同じ", function() {
		var lb = new LangBank(__dirname+'/testdata/placeholders.csv', {"template": true});
		assert.strictEqual(lb.get('greet', {"name": "Tom"}), 'Hi Tom');
	});

	it("fallback の値には文字列も書ける", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv', {"fallback": {"zh-HK": "zh-Hant"}});
		lb.setLang('zh-HK');
		assert.strictEqual(lb.get('hello'), '你好');
	});

	it("構築した後に options を書き換えても影響しない", function() {
		var options = {"bind": {"test1": "A"}, "fallback": {"zh-HK": ["zh-Hant"]}};
		var lb = new LangBank([listCsv, __dirname+'/testdata/regional.csv'], options);
		options.bind.test1 = 'B';
		options.fallback['zh-HK'].push('pt');
		options.template = false;
		assert.strictEqual(lb.get('bind1'), 'test A');
		lb.setLang('zh-HK');
		assert.strictEqual(lb.get('color'), '顏色');
	});

	it("読み込み元のリストの中の CSV 配列に空の行があってもよい", function() {
		var lb = new LangBank([[["", "en"], null, ["a", "A"], undefined], listCsv]);
		assert.strictEqual(lb.get('a'), 'A');
		assert.strictEqual(lb.get('hello'), 'Hello');
		lb = new LangBank([listCsv, [null, ["", "en"], ["b", "B"]]]);
		assert.strictEqual(lb.get('b'), 'B');
	});

	it("new を付けずに呼ぶと TypeError", function() {
		assert.throws(function(){
			LangBank(listCsv);
		}, TypeError);
		assert.strictEqual(typeof(globalThis.setLang), 'undefined');
	});

	it("__proto__ というキーのオプションやバインドデータを扱える", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv', {
			"fallback": JSON.parse('{"__proto__": ["ja"]}')
		});
		lb.setLang('__proto__');
		assert.strictEqual(lb.get('hello'), 'こんにちは');

		lb = new LangBank('"","en"'+"\n"+'"k","[{{ x }}]"', {
			"bind": JSON.parse('{"__proto__": {"x": "inherited"}}')
		});
		assert.strictEqual(lb.get('k'), '[]');
		assert.strictEqual(lb.get('k', JSON.parse('{"__proto__": {"x": "inherited"}}')), '[]');
		assert.strictEqual(lb.get('k', {"x": "X"}), '[X]');

		// __proto__ という名前の変数
		lb = new LangBank('"","en"'+"\n"+'"k","[{{ __proto__ }}]"', {
			"bind": JSON.parse('{"__proto__": "global"}')
		});
		assert.strictEqual(lb.get('k'), '[global]');
		assert.strictEqual(lb.get('k', JSON.parse('{"__proto__": "local"}')), '[local]');
		assert.strictEqual(new LangBank('"","en"'+"\n"+'"k","[{{ __proto__ }}]"').get('k', {}), '[]');
	});

	it("読み込み元のリストの中の空の要素を読み飛ばす", function() {
		var lb = new LangBank([listCsv, null, undefined, '', []]);
		assert.strictEqual(lb.get('hello'), 'Hello');
		lb = new LangBank([null]);
		assert.deepStrictEqual(lb.getLangList(), []);
		lb.load([undefined, __dirname+'/testdata/regional.csv']);
		assert.strictEqual(lb.getDefaultLang(), 'en');
	});

	it("has() の exact オプション", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv', {"fallback": {"en-GB": "en-US"}});
		lb.setLang('en-GB');
		assert.strictEqual(lb.has('color'), true);
		assert.strictEqual(lb.has('color', {"exact": true}), false);
		lb.setLang('ja_JP');
		assert.strictEqual(lb.has('hello', {"exact": true}), false);
		lb.setLang('JA');
		assert.strictEqual(lb.has('hello', {"exact": true}), true);
		lb.setLang('en-US');
		assert.strictEqual(lb.has('hello', {"exact": true}), false);
		assert.strictEqual(lb.has('hello', {"exact": null}), true);
		assert.strictEqual(lb.has('hello', {"exact": false}), true);
		[{"x": 1}, {"fallback": false}, {"exact": "yes"}].forEach(function(options){
			assertLangBankError(function(){
				lb.has('hello', options);
			}, 'INVALID_OPTION');
		});
	});

	it("エラーコードの定数", function() {
		[
			'FILE_NOT_FOUND', 'FILE_READ_ERROR', 'INVALID_SOURCE', 'INVALID_CSV',
			'TEMPLATE_ERROR', 'INVALID_OPTION'
		].forEach(function(code){
			assert.strictEqual(LangBank.LangBankError[code], code);
		});
		// v2 で廃止したコード
		assert.strictEqual(LangBank.LangBankError.CSV_PARSE_ERROR, undefined);
		assert.strictEqual(LangBank.LangBankError.CIRCULAR_REFERENCE, undefined);
	});

	it("withLang() は言語を固定したビューを返す", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv');
		var ja = lb.withLang('ja');
		assert.strictEqual(ja.get('hello'), 'こんにちは');
		assert.strictEqual(lb.get('hello'), 'Hello');
		lb.setLang('pt');
		assert.strictEqual(ja.get('hello'), 'こんにちは');
		assert.strictEqual(ja.getLang(), 'ja');
		assert.strictEqual(ja.lang, 'ja');
		assert.strictEqual(ja.getDefaultLang(), 'en');
		assert.strictEqual(ja.defaultLang, 'en');
		assert.strictEqual(ja.has('color'), true);
		assert.strictEqual(ja.has('color', {"exact": true}), true);
		assert.strictEqual(ja.get('undefinedKey', 'DEF'), 'DEF');
		assert.ok(Object.isFrozen(ja));
		assert.strictEqual(typeof(ja.setLang), 'undefined');
		assert.strictEqual(typeof(ja.load), 'undefined');

		// 辞書は共有する
		lb.load('"","ja"'+"\n"+'"new","新規"'+"\n");
		assert.strictEqual(ja.get('new'), '新規');

		// 言語なしはデフォルト言語。文字列以外は文字列にする
		assert.strictEqual(lb.withLang(null).getLang(), null);
		assert.strictEqual(lb.withLang().lang, null);
		assert.strictEqual(lb.withLang().get('hello'), 'Hello');
		assert.strictEqual(lb.withLang(123).getLang(), '123');
	});

	it("withLang() のビューでもプレースホルダーを置き換える", function() {
		var lb = new LangBank(__dirname+'/testdata/placeholders.csv', {"bind": {"name": "Global"}});
		assert.strictEqual(lb.withLang('ja').get('ja_only'), '日本語 Global');
		assert.strictEqual(lb.withLang('ja').get('ja_only', {"name": "太郎"}), '日本語 太郎');
		assert.strictEqual(lb.withLang('ja').get('nokey', {"name": "x"}, '[{{ name }}]'), '[x]');
		assertLangBankError(function(){
			lb.withLang('ja').get('nokey', null, '{% x %}');
		}, 'TEMPLATE_ERROR');
	});

	it("withLang() のビューでも onMissing に言語を渡す", function() {
		var log = [];
		var lb = new LangBank(listCsv, {
			"onMissing": function(key, lang){ log.push(key+':'+lang); }
		});
		assert.strictEqual(lb.withLang('fr').get('nope'), 'nope');
		assert.deepStrictEqual(log, ['nope:fr']);
	});

	it("setLang() は null/undefined を null に、それ以外を文字列にする", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv');
		assert.strictEqual(lb.setLang(undefined), false);
		assert.strictEqual(lb.getLang(), null);
		lb.setLang();
		assert.strictEqual(lb.getLang(), null);
		assert.strictEqual(lb.get('hello'), 'Hello');
		lb.setLang(123);
		assert.strictEqual(lb.getLang(), '123');
		lb.setLang('JA_jp');
		assert.strictEqual(lb.getLang(), 'JA_jp');
		assert.strictEqual(lb.get('hello'), 'こんにちは');
	});

	it("resolveLang()", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv', {"fallback": {"zh-HK": ["zh-TW", "zh-Hant"]}});
		assert.strictEqual(lb.resolveLang('ja'), 'ja');
		assert.strictEqual(lb.resolveLang('JA_jp'), 'ja');
		assert.strictEqual(lb.resolveLang('EN-us'), 'en-US');
		assert.strictEqual(lb.resolveLang('en-GB'), 'en');
		assert.strictEqual(lb.resolveLang('zh-HK'), 'zh-Hant');
		assert.strictEqual(lb.resolveLang('zh-Hant-TW'), 'zh-Hant');
		assert.strictEqual(lb.resolveLang('xx'), null);
		assert.strictEqual(lb.resolveLang(''), null);
		assert.strictEqual(lb.resolveLang(null), null);

		// セルの内容は調べない (en-US の hello は空)
		lb.setLang('en-US');
		assert.strictEqual(lb.resolveLang(), 'en-US');
		assert.strictEqual(lb.resolveLang(undefined), 'en-US');
		assert.strictEqual(lb.get('hello'), 'Hello');

		// 省略すると現在の言語。setLang() の戻り値と対応する
		lb.setLang('xx');
		assert.strictEqual(lb.resolveLang(), null);
		lb.setLang(null);
		assert.strictEqual(lb.resolveLang(), null);
		assert.strictEqual(lb.resolveLang('pt-BR'), 'pt');

		assert.strictEqual(new LangBank().resolveLang('en'), null);
	});

	it("resolveLang() はフォールバック先の言語からさらにフォールバックしない", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv', {"fallback": {"zh-HK": "zh-Hant-TW", "zh-MO": "zh-TW", "zh-TW": "zh-Hant"}});
		assert.strictEqual(lb.resolveLang('zh-HK'), null);
		assert.strictEqual(lb.resolveLang('zh-MO'), null);
		assert.strictEqual(lb.resolveLang('zh-TW'), 'zh-Hant');
	});

	it("ビューの resolveLang() と getLangList()", function() {
		var lb = new LangBank(__dirname+'/testdata/regional.csv');
		lb.setLang('ja');
		var view = lb.withLang('en-GB');
		assert.strictEqual(view.resolveLang(), 'en');
		assert.strictEqual(view.resolveLang(undefined), 'en');
		assert.strictEqual(view.resolveLang('JA'), 'ja');
		assert.strictEqual(view.resolveLang(null), null);
		assert.strictEqual(lb.withLang(null).resolveLang(), null);
		assert.deepStrictEqual(view.getLangList(), ['en', 'en-US', 'ja', 'zh-Hant', 'pt']);

		// コピーを返し、呼び出した時点の辞書を反映する
		view.getLangList().push('xx');
		lb.load('"","fr"'+"\n"+'"hello","Bonjour"');
		assert.deepStrictEqual(view.getLangList(), ['en', 'en-US', 'ja', 'zh-Hant', 'pt', 'fr']);
	});

	it("setLang() を呼んだ後の load() は現在の言語を変えない", function() {
		var lb = new LangBank();
		lb.setLang(null);
		lb.load(__dirname+'/testdata/regional.csv');
		assert.strictEqual(lb.getLang(), null);
		assert.strictEqual(lb.getDefaultLang(), 'en');

		lb = new LangBank();
		lb.setLang('ja');
		lb.load(__dirname+'/testdata/regional.csv');
		assert.strictEqual(lb.getLang(), 'ja');

		// 空の読み込み元では初期言語を決めない
		lb = new LangBank([null, '"","ja","en"'+"\n"+'"k","値","v"']);
		assert.strictEqual(lb.getLang(), 'ja');
		assert.strictEqual(lb.getDefaultLang(), 'ja');
	});

	it("load() はエラーなら辞書を変えない", function() {
		var lb = new LangBank();
		[
			[__dirname+'/testdata/regional.csv', __dirname+'/testdata/notExists.csv'],
			[__dirname+'/testdata/regional.csv', [["key"], ["k", "v"]]],
			[__dirname+'/testdata/regional.csv', [["", "en"], "x"]],
			[__dirname+'/testdata/regional.csv', [["", "en"], [{}]]],
			[__dirname+'/testdata/regional.csv', '"","en"\n"k","{% broken %}"'],
			[__dirname+'/testdata/regional.csv', 1]
		].forEach(function(src){
			assert.throws(function(){
				lb.load(src);
			}, LangBank.LangBankError);
			assert.deepStrictEqual(lb.getList(), {});
			assert.deepStrictEqual(lb.getLangList(), []);
			assert.strictEqual(lb.getLang(), null);
			assert.strictEqual(lb.getDefaultLang(), null);
			assert.strictEqual(lb.resolveLang('en'), null);
		});

		// 失敗した読み込みは、次の読み込みに影響しない
		lb.load('"","ja","en"'+"\n"+'"k","値","v"');
		assert.deepStrictEqual(lb.getLangList(), ['ja', 'en']);
		assert.strictEqual(lb.getLang(), 'ja');
		assert.strictEqual(lb.getDefaultLang(), 'ja');
		assert.deepStrictEqual(lb.getList(), {"k": {"ja": "値", "en": "v"}});

		// 読み込み済みの辞書も変えない
		var view = lb.withLang('fr');
		lb.setLang('en');
		assert.throws(function(){
			lb.load([__dirname+'/testdata/regional.csv', [["key"], ["k", "v"]]]);
		}, LangBank.LangBankError);
		assert.deepStrictEqual(lb.getLangList(), ['ja', 'en']);
		assert.deepStrictEqual(lb.getList(), {"k": {"ja": "値", "en": "v"}});
		assert.strictEqual(lb.getLang(), 'en');
		assert.strictEqual(lb.getDefaultLang(), 'ja');
		assert.strictEqual(lb.resolveLang('fr'), null);
		assert.deepStrictEqual(view.getLangList(), ['ja', 'en']);
		assert.strictEqual(view.get('k'), '値');

		// setLang(null) の後に失敗しても、次の読み込みで初期言語を設定しない
		lb = new LangBank();
		lb.setLang(null);
		assert.throws(function(){
			lb.load([__dirname+'/testdata/regional.csv', 1]);
		}, LangBank.LangBankError);
		lb.load(__dirname+'/testdata/regional.csv');
		assert.strictEqual(lb.getLang(), null);
		assert.strictEqual(lb.getDefaultLang(), 'en');
	});

	it("load() はセルを一度だけ読む (読み直しによる部分的な反映がない)", function() {
		var lb = new LangBank();
		var reads = 0;
		var row = ['k', 'v'];
		Object.defineProperty(row, 1, {
			"enumerable": true,
			"get": function(){
				if( ++reads > 1 ){ throw new Error('cell read twice'); }
				return 'v';
			}
		});
		lb.load([["", "en"], row]);
		assert.strictEqual(reads, 1);
		assert.deepStrictEqual(lb.getList(), {"k": {"en": "v"}});
	});

	it("キーは文字列か数値に限る", function() {
		var lb = new LangBank('"","en"\n"123","num"\n');
		var view = lb.withLang('en');
		[undefined, null, true, {}, ['a']].forEach(function(key){
			assert.throws(function(){ lb.get(key); }, TypeError);
			assert.throws(function(){ lb.has(key); }, TypeError);
			assert.throws(function(){ view.get(key); }, TypeError);
			assert.throws(function(){ view.has(key); }, TypeError);
		});
		assert.throws(function(){ lb.get(); }, TypeError);
		assert.strictEqual(lb.get(123), 'num');
		assert.strictEqual(lb.has(123), true);
		assert.strictEqual(lb.get(''), '');
	});

	it("getList() は、すべてのキーにすべての言語を持たせる", function() {
		var lb = new LangBank('"","en"\n"a","A"\n');
		lb.load('"","JA","ja"\n"b","B",""\n');
		assert.deepStrictEqual(lb.getLangList(), ['en', 'JA']);
		assert.deepStrictEqual(lb.getList(), {
			"a": {"en": "A", "JA": ""},
			"b": {"en": "", "JA": "B"}
		});
	});

	it("サブクラスでメソッドをオーバーライドしても使われない (ラッパーを使う)", function() {
		class My extends LangBank {
			get(){ return 'overridden'; }
		}
		assert.strictEqual(new My(listCsv).get('hello'), 'Hello');
	});

});
