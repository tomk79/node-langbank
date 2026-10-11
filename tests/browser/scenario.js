/**
 * ブラウザ (と、Node.js のグローバルがない vm) の中で実行するシナリオ
 *
 * scenario() は、文字列にしてブラウザに送るので、外の変数を参照しないこと。
 * グローバル変数 LangBankBundle (bundle.js のバンドル) を使い、結果をオブジェクトで返す。
 */
function scenario(){
	var LangBank = LangBankBundle['default'];
	var LangBankError = LangBankBundle.LangBankError;
	var rtn = {};

	function errorCode(fn){
		try{
			fn();
		}catch(e){
			return (e instanceof LangBankError) ? e.code : 'not LangBankError: '+e;
		}
		return null;
	}

	// BOM, CRLF, "" のエスケープ, 引用符の中の改行
	var csv = '﻿"","en","ja"\r\n"dialog.deleteMemo.message","Delete ""{{ topic }}""?","「{{ topic }}」を削除しますか？"\r\n"multi","a\r\nb",""\r\n';
	var lb = new LangBank(csv);
	rtn.langList = lb.getLangList();
	rtn.setLangJa = lb.setLang('ja');
	rtn.setLangXx = lb.setLang('xx');
	lb.setLang('ja');
	rtn.message = lb.get('dialog.deleteMemo.message', {'topic': 'メモ'});
	rtn.notEvaluated = lb.get('dialog.deleteMemo.message', {'topic': '{{ x }} {% y %}'});
	rtn.missingVar = lb.get('dialog.deleteMemo.message');
	rtn.multi = lb.withLang('en').get('multi');
	rtn.hasExact = lb.has('multi', {'exact': true});
	rtn.hasFallback = lb.has('multi');

	// パース済みの配列と onMissing
	var missing = [];
	lb = new LangBank([['', 'en'], ['k', 'v']], {'onMissing': function(key, lang){ missing.push(key+':'+lang); }});
	rtn.fromArray = lb.get('k');
	rtn.missingKey = lb.get('nokey');
	rtn.onMissing = missing;

	// ファイルのパスは読めない
	rtn.filePath = errorCode(function(){ new LangBank('/path/to/list.csv'); });

	// 予約した構文は読み込み時にエラー
	rtn.reserved = errorCode(function(){ new LangBank([['', 'en'], ['k', '{% if x %}']]); });

	return rtn;
}

/** scenario() の期待値 */
scenario.expected = {
	'langList': ['en', 'ja'],
	'setLangJa': true,
	'setLangXx': false,
	'message': '「メモ」を削除しますか？',
	'notEvaluated': '「{{ x }} {% y %}」を削除しますか？',
	'missingVar': '「」を削除しますか？',
	'multi': 'a\r\nb',
	'hasExact': false,
	'hasFallback': true,
	'fromArray': 'v',
	'missingKey': 'nokey',
	'onMissing': ['nokey:en'],
	'filePath': 'FILE_NOT_FOUND',
	'reserved': 'TEMPLATE_ERROR'
};

module.exports = scenario;
