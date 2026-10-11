/**
 * ブラウザ向けのテストで使う、esbuild のバンドル
 */
var fs = require('fs');
var os = require('os');
var path = require('path');
var esbuild = require('esbuild');

/**
 * langbank をブラウザ向けにバンドルする (ポリフィルなし)
 *
 * 利用者と同じように、パッケージの名前 (langbank) で import して、package.json の exports と browser フィールドを通す。
 * (一時ディレクトリの node_modules/langbank から、このリポジトリにリンクする)
 * 戻り値は {code, inputs}。code は、グローバル変数 LangBankBundle に ESM の名前空間を入れる IIFE。
 */
module.exports = function bundle(options){
	var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'langbank-'));
	try{
		fs.mkdirSync(path.join(tmpDir, 'node_modules'));
		fs.symlinkSync(path.resolve(__dirname, '../..'), path.join(tmpDir, 'node_modules', 'langbank'), 'junction');
		var result = esbuild.buildSync(Object.assign({
			'stdin': {
				'contents': "export { default, LangBankError } from 'langbank';",
				'resolveDir': tmpDir
			},
			'bundle': true,
			'platform': 'browser',
			'format': 'iife',
			'globalName': 'LangBankBundle',
			'target': ['es2015'],
			'write': false,
			'metafile': true,
			'logLevel': 'silent'
		}, options || {}));
		return {
			'code': result.outputFiles[0].text,
			'inputs': Object.keys(result.metafile.inputs).map(function(input){
				// リンクを解決したパスは、リポジトリからの相対パスにする
				return path.relative(path.resolve(__dirname, '../..'), path.resolve(input)).split(path.sep).join('/');
			})
		};
	}finally{
		fs.rmSync(tmpDir, {'recursive': true, 'force': true});
	}
};
