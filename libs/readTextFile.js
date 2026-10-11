/**
 * langbank.js: ファイルを読み込む (NodeJS 用)
 *
 * ブラウザ向けのバンドルでは、package.json の browser フィールドで readTextFile.browser.js に差し替える。
 */
var fs = null;
try{
	fs = require('fs');
}catch(e){
	// fs が使えない環境
}

/**
 * ファイルを UTF-8 の文字列として読み込む
 *
 * 戻り値は {content} か {error, cause}。error は 'NO_FILE_SYSTEM', 'FILE_NOT_FOUND', 'FILE_READ_ERROR' のいずれか。
 */
function readTextFile(path){
	if( !fs || typeof(fs.existsSync) !== 'function' ){
		return {'error': 'NO_FILE_SYSTEM'};
	}
	if( !fs.existsSync(path) ){
		return {'error': 'FILE_NOT_FOUND'};
	}
	try{
		if( !fs.statSync(path).isFile() ){
			return {'error': 'FILE_NOT_FOUND'};
		}
		return {'content': fs.readFileSync(path, 'utf8')};
	}catch(e){
		return {'error': 'FILE_READ_ERROR', 'cause': e};
	}
}

module.exports = readTextFile;
