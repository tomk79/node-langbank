/**
 * langbank.js: ファイルを読み込む (ブラウザ用)
 *
 * ブラウザにはファイルシステムがないので、常に読めない。
 * package.json の browser フィールドで、readTextFile.js の代わりに使う。
 */
module.exports = function readTextFile(){
	return {'error': 'NO_FILE_SYSTEM'};
};
