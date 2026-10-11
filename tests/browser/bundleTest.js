var assert = require('assert');
var vm = require('vm');
var zlib = require('zlib');
var bundle = require('./bundle.js');
var scenario = require('./scenario.js');

/** バンドルのサイズの上限 (バイト)。依存が紛れ込むなどして大きくなったら気づけるようにする */
var SIZE_LIMIT_MINIFIED = 12 * 1024;
var SIZE_LIMIT_GZIP = 4.5 * 1024;

describe('Browser bundle (esbuild, ポリフィルなし)', function() {

	it("ファイルを読む処理は、ブラウザ用の実装に差し替える", function() {
		var inputs = bundle().inputs;
		assert.ok(inputs.indexOf('libs/readTextFile.browser.js') >= 0, inputs.join(', '));
		assert.ok(inputs.indexOf('libs/readTextFile.js') < 0, inputs.join(', '));
		assert.ok(inputs.every(function(input){ return input.indexOf('node_modules') < 0; }), 'No dependencies are bundled: '+inputs.join(', '));
	});

	it("Node.js の組み込みモジュールを参照しない", function() {
		var code = bundle().code;
		assert.ok(!/\brequire\s*\(/.test(code), 'require() is not in the bundle');
		['Buffer', 'process', 'readFileSync', 'existsSync'].forEach(function(name){
			assert.ok(code.indexOf(name) < 0, name+' is not in the bundle');
		});
	});

	it("Node.js のグローバルがない環境で読み込んで使える", function() {
		// vm の新しいコンテキストには、Buffer, process, require, setTimeout などがない
		var context = vm.createContext({});
		assert.strictEqual(vm.runInContext('typeof Buffer + typeof process + typeof require', context), 'undefinedundefinedundefined');
		vm.runInContext(bundle().code, context);
		var result = vm.runInContext('('+scenario.toString()+')()', context);
		assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), scenario.expected);
	});

	it("バンドルのサイズ", function() {
		var code = bundle({'minify': true}).code;
		var gzip = zlib.gzipSync(code).length;
		console.log('      minified: '+code.length+' bytes, gzip: '+gzip+' bytes');
		assert.ok(code.length <= SIZE_LIMIT_MINIFIED, 'minified: '+code.length+' > '+SIZE_LIMIT_MINIFIED);
		assert.ok(gzip <= SIZE_LIMIT_GZIP, 'gzip: '+gzip+' > '+SIZE_LIMIT_GZIP);
	});

});
