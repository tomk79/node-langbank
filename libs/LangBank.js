/**
 * langbank.js
 */
var parseCsv = require('./parseCsv.js');
var readTextFile = require('./readTextFile.js'); // ブラウザ向けのバンドルでは readTextFile.browser.js

/** エラーコード */
var ERROR_CODES = [
	'FILE_NOT_FOUND',
	'FILE_READ_ERROR',
	'INVALID_SOURCE',
	'INVALID_CSV',
	'TEMPLATE_ERROR',
	'INVALID_OPTION'
];

/**
 * LangBank のエラー
 */
function LangBankError(code, message, cause){
	this.name = 'LangBankError';
	this.code = code;
	this.message = message;
	if( cause !== undefined ){
		this.cause = cause;
	}
	if( Error.captureStackTrace ){
		Error.captureStackTrace(this, LangBankError);
	}else{
		this.stack = (new Error(message)).stack;
	}
}
LangBankError.prototype = Object.create(Error.prototype);
LangBankError.prototype.constructor = LangBankError;
ERROR_CODES.forEach(function(code){
	LangBankError[code] = code;
});

/**
 * セルの値を文字列にする
 */
function toStr(value){
	if( value === null || value === undefined ){
		return '';
	}
	return String(value);
}

/**
 * 言語コードを照合用に正規化する
 */
function normalizeLang(lang){
	return toStr(lang).toLowerCase().replace(/_/g, '-');
}

/**
 * 配列ではないオブジェクトか
 */
function isPlainObject(value){
	return value !== null && typeof(value) === 'object' && !Array.isArray(value);
}

/**
 * エラーメッセージ用に、値の型を説明する
 */
function describeType(value){
	if( value === null ){
		return 'null';
	}
	if( Array.isArray(value) ){
		return 'array';
	}
	return typeof(value);
}

/**
 * 空の読み込み元か (読み込み元のリストの中では読み飛ばす)
 */
function isEmptySource(value){
	return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * パース済みCSV配列に見えるか (配列の行を 1 つ以上含み、それ以外の行は null か undefined)
 */
function is2dArray(value){
	return Array.isArray(value) && value.some(Array.isArray) && value.every(function(row){
		return Array.isArray(row) || row === null || row === undefined;
	});
}

/**
 * 文字列を、CSV文字列またはファイルパスとして読み込む
 */
function readCsvString(src){
	if( /[\r\n]/.test(src) ){
		// 改行を含む文字列は CSV として扱う
		return parseCsv(src);
	}

	// 改行を含まない文字列はファイルパスとして扱う
	var result = readTextFile(src);
	if( result.error === 'NO_FILE_SYSTEM' ){
		throw new LangBankError('FILE_NOT_FOUND', 'File not found (file system is not available): '+src);
	}
	if( result.error === 'FILE_NOT_FOUND' ){
		throw new LangBankError('FILE_NOT_FOUND', 'File not found: '+src);
	}
	if( result.error ){
		throw new LangBankError('FILE_READ_ERROR', 'Failed to read file: '+src, result.cause);
	}
	return parseCsv(result.content);
}

/**
 * プレースホルダー ({{ name }}) か、予約した構文 ({{, {%, {#) にマッチする正規表現
 *
 * 予約した構文にマッチしたときは、1 番目のグループが undefined になる。
 */
function placeholderPattern(){
	return /\{\{[ \t\r\n]*([A-Za-z_][A-Za-z0-9_]*)[ \t\r\n]*\}\}|\{[{%#]/g;
}

/**
 * 予約した構文のうち、正しいプレースホルダーにならないものの位置を返す (なければ -1)
 */
function findReservedSyntax(template){
	if( template.indexOf('{') < 0 ){
		return -1;
	}
	var pattern = placeholderPattern();
	var matched;
	while( (matched = pattern.exec(template)) !== null ){
		if( !matched[1] ){
			return matched.index;
		}
	}
	return -1;
}

/**
 * 訳文やデフォルト値のエラーメッセージ用に、場所を説明する
 */
function describeTemplate(isDefault, key, lang){
	return (isDefault ? 'the default value' : 'the word')+' of key "'+key+'" (lang: '+lang+')';
}

/**
 * 予約した構文のエラー
 */
function reservedSyntaxError(template, index, where){
	return new LangBankError('TEMPLATE_ERROR', 'Unsupported syntax in '+where+': "'+template.slice(index, index + 20)+'". Only placeholders like {{ name }} are supported.');
}

/**
 * プレースホルダーに差し込む値を文字列にする
 */
function toPlaceholderValue(value, name, where){
	if( value === null || value === undefined ){
		return '';
	}
	if( typeof(value) === 'string' ){
		return value;
	}
	if( typeof(value) === 'number' ){
		return String(value);
	}
	if( typeof(value) === 'boolean' ){
		return value ? '1' : '';
	}
	throw new LangBankError('TEMPLATE_ERROR', 'Unsupported type of the value "'+name+'" ('+describeType(value)+') in '+where+'.');
}

/**
 * 読み込み元を、パース済みCSV配列のリストにする
 */
function toCsvArrays(src){
	if( src === null || src === undefined || src === '' ){
		return [];
	}
	if( typeof(src) === 'string' ){
		return [readCsvString(src)];
	}
	if( Array.isArray(src) ){
		var isSourceList = src.length > 0 && src.every(function(item){
			return isEmptySource(item) || typeof(item) === 'string' || is2dArray(item);
		});
		if( !isSourceList ){
			// パース済みのCSV配列
			return [src];
		}
		var rtn = [];
		src.forEach(function(item){
			rtn = rtn.concat(toCsvArrays(item));
		});
		return rtn;
	}
	throw new LangBankError('INVALID_SOURCE', 'Unsupported source type: '+(typeof src));
}

/**
 * オプションの検証と正規化
 */
var OPTION_NORMALIZERS = {
	'bind': function(value){
		if( !isPlainObject(value) ){
			throw new LangBankError('INVALID_OPTION', 'Option "bind" must be an object.');
		}
		// 自身の列挙可能なプロパティだけを、浅くコピーする
		var rtn = {};
		Object.keys(value).forEach(function(key){
			setProp(rtn, key, value[key]);
		});
		return rtn;
	},
	'template': function(value){
		if( typeof(value) !== 'boolean' ){
			throw new LangBankError('INVALID_OPTION', 'Option "template" must be a boolean.');
		}
		return value;
	},
	'onMissing': function(value){
		if( typeof(value) !== 'function' ){
			throw new LangBankError('INVALID_OPTION', 'Option "onMissing" must be a function.');
		}
		return value;
	},
	'fallback': function(value){
		if( !isPlainObject(value) ){
			throw new LangBankError('INVALID_OPTION', 'Option "fallback" must be an object.');
		}
		var rtn = {};
		Object.keys(value).forEach(function(lang){
			var langs = (typeof(value[lang]) === 'string') ? [value[lang]] : value[lang];
			if( !Array.isArray(langs) || !langs.every(function(l){ return typeof(l) === 'string'; }) ){
				throw new LangBankError('INVALID_OPTION', 'Option "fallback" must map a language to a string or an array of strings: '+lang);
			}
			setProp(rtn, lang, langs.slice());
		});
		return rtn;
	}
};

/**
 * オプションを検証し、正規化したコピーを返す
 */
function normalizeOptions(options){
	if( options === null || options === undefined ){
		return {};
	}
	if( !isPlainObject(options) ){
		// 引数の型の誤り (オプションの中身の誤りは INVALID_OPTION)
		throw new TypeError('Options must be an object, '+describeType(options)+' given.');
	}
	var rtn = {};
	Object.keys(options).forEach(function(name){
		if( !Object.prototype.hasOwnProperty.call(OPTION_NORMALIZERS, name) ){
			throw new LangBankError('INVALID_OPTION', 'Unknown option: '+name);
		}
		if( options[name] === null || options[name] === undefined ){
			return;
		}
		rtn[name] = OPTION_NORMALIZERS[name](options[name]);
	});
	return rtn;
}

/**
 * has() のオプションを検証する
 */
function normalizeHasOptions(options){
	var rtn = {'exact': false};
	if( options === null || options === undefined ){
		return rtn;
	}
	if( !isPlainObject(options) ){
		throw new TypeError('Options of has() must be an object, '+describeType(options)+' given.');
	}
	Object.keys(options).forEach(function(name){
		if( name !== 'exact' ){
			throw new LangBankError('INVALID_OPTION', 'Unknown option of has(): '+name);
		}
		if( options[name] === null || options[name] === undefined ){
			return;
		}
		if( typeof(options[name]) !== 'boolean' ){
			throw new LangBankError('INVALID_OPTION', 'Option "exact" of has() must be a boolean.');
		}
		rtn.exact = options[name];
	});
	return rtn;
}

/**
 * キーを検証して文字列にする (文字列か数値に限る)
 */
function toKey(key){
	if( typeof(key) !== 'string' && typeof(key) !== 'number' ){
		throw new TypeError('Key must be a string or a number, '+describeType(key)+' given.');
	}
	return String(key);
}

/**
 * get() の引数を解釈する
 *
 * 第 2 引数が文字列で、第 3 引数が null か undefined なら、第 2 引数をデフォルト値とする。
 * (引数の数ではなく型で判定するので、ラッパー関数から引数をそのまま渡せる)
 */
function parseGetArgs(args){
	var bindData = args[1];
	var defaultValue = args[2];
	if( typeof(bindData) === 'string' && (defaultValue === null || defaultValue === undefined) ){
		return {'bindData': null, 'defaultValue': bindData};
	}
	return {'bindData': bindData, 'defaultValue': defaultValue};
}

/**
 * プロパティの定義 (`__proto__` などのキーも安全に扱う)
 */
function setProp(obj, key, value){
	Object.defineProperty(obj, key, {
		'value': value,
		'enumerable': true,
		'writable': true,
		'configurable': true
	});
}

/**
 * LangBank
 */
var LangBank = function(src, options){
	if( !(this instanceof LangBank) ){
		throw new TypeError("Class constructor LangBank cannot be invoked without 'new'");
	}
	if( arguments.length > 2 && arguments[2] !== undefined ){
		// v1 のコールバック (v2 で廃止)
		throw new TypeError('LangBank does not take the 3rd argument. The callback was removed in v2: the dictionary is loaded synchronously.');
	}
	var _this = this;
	this.options = normalizeOptions(options);
	this.pathCsv = src;

	this.langDb = Object.create(null);
	this.defaultLang = null;
	this.lang = null;

	var langList = [];
	var langMap = Object.create(null); // 正規化した言語コード => 列名
	var langIsSet = false; // setLang() が呼ばれたか

	/**
	 * パース済みのCSV配列を検証する
	 *
	 * 辞書は変更しない。空のCSVなら null、そうでなければ {rows, header} を返す。
	 * rows は、セルを一度だけ読んで文字列にしたコピー (マージの途中で入力を読み直さない)。
	 * header は、列のインデックス => 言語名 (言語の列だけ)。
	 * 訳文に予約した構文があれば、TEMPLATE_ERROR を投げる。
	 */
	function prepareCsv(csvAry){
		var rows = [];
		csvAry.forEach(function(row){
			if( row === null || row === undefined ){
				return;
			}
			if( !Array.isArray(row) ){
				throw new LangBankError('INVALID_SOURCE', 'Each row of CSV array must be an array.');
			}
			var cells = [];
			for( var i = 0; i < row.length; i ++ ){
				var cell = row[i];
				if( cell !== null && cell !== undefined && typeof(cell) !== 'string' && typeof(cell) !== 'number' && typeof(cell) !== 'boolean' ){
					throw new LangBankError('INVALID_SOURCE', 'Each cell of CSV array must be a scalar value.');
				}
				cells.push(toStr(cell));
			}
			if( cells.some(function(cell){ return cell !== ''; }) ){
				rows.push(cells);
			}
		});
		if( !rows.length ){
			return null;
		}

		var header = [];
		rows[0].forEach(function(lang, idx){
			if( idx > 0 && lang !== '' ){
				header[idx] = lang;
			}
		});
		if( !header.some(function(lang){ return lang !== undefined; }) ){
			throw new LangBankError('INVALID_CSV', 'CSV header has no language columns.');
		}

		if( _this.options.template !== false ){
			// 訳文の予約した構文は、表示する前に (読み込み時に) 見つける
			rows.slice(1).forEach(function(row){
				if( row[0] === '' ){
					return;
				}
				header.forEach(function(lang, idx){
					var cell = (idx < row.length) ? row[idx] : '';
					var index = findReservedSyntax(cell);
					if( index >= 0 ){
						throw reservedSyntaxError(cell, index, describeTemplate(false, row[0], lang));
					}
				});
			});
		}
		return {'rows': rows, 'header': header};
	}

	/**
	 * prepareCsv() で検証したCSVを辞書にマージする
	 */
	function mergeCsv(prepared){
		var rows = prepared.rows;

		// 大小文字や _/- だけが違う言語名は、最初に現れた表記の列にまとめる
		var langIdx = [];
		var firstLang = null;
		prepared.header.forEach(function(lang, idx){
			var normalized = normalizeLang(lang);
			if( !(normalized in langMap) ){
				langMap[normalized] = lang;
				langList.push(lang);
			}
			langIdx[idx] = langMap[normalized];
			if( firstLang === null ){
				firstLang = langIdx[idx];
			}
		});

		if( _this.defaultLang === null ){
			// 最初に読み込んだCSVの最初の列を、デフォルト言語にする
			// setLang() が呼ばれていなければ、初期言語にもする
			_this.defaultLang = firstLang;
			if( !langIsSet ){
				_this.lang = firstLang;
			}
		}

		rows.slice(1).forEach(function(row){
			var key = row[0];
			if( key === '' ){
				return;
			}
			if( !(key in _this.langDb) ){
				_this.langDb[key] = Object.create(null);
			}
			var entry = _this.langDb[key];
			langIdx.forEach(function(lang, idx){
				var value = (idx < row.length) ? row[idx] : '';
				if( value !== '' || !(lang in entry) ){
					// 空でないセルだけで後勝ちする
					entry[lang] = value;
				}
			});
		});
	}

	/**
	 * 言語の候補を、辞書の列名のリストにする
	 *
	 * useFallback が false なら、その言語の列だけを探す。
	 */
	function resolveLangs(lang, useFallback, includeDefault){
		var candidates = [];
		function add(l){
			var normalized = normalizeLang(l);
			if( normalized !== '' && candidates.indexOf(normalized) < 0 ){
				candidates.push(normalized);
			}
		}

		if( toStr(lang) !== '' ){
			add(lang);
		}

		if( useFallback && toStr(lang) !== '' ){
			var fallback = _this.options.fallback;
			if( fallback ){
				Object.keys(fallback).forEach(function(fallbackKey){
					if( normalizeLang(fallbackKey) !== normalizeLang(lang) ){
						return;
					}
					fallback[fallbackKey].forEach(add);
				});
			}

			var parts = normalizeLang(lang).split('-');
			while( parts.length > 1 ){
				parts.pop();
				add(parts.join('-'));
			}
		}

		var rtn = [];
		candidates.forEach(function(normalized){
			var column = langMap[normalized];
			if( column !== undefined && rtn.indexOf(column) < 0 ){
				rtn.push(column);
			}
		});
		if( includeDefault && _this.defaultLang !== null && rtn.indexOf(_this.defaultLang) < 0 ){
			rtn.push(_this.defaultLang);
		}
		return rtn;
	}

	/**
	 * 言語を辞書の列名に解決する (デフォルト言語へのフォールバックは含めない。見つからなければ null)
	 */
	function resolveLangFor(lang){
		var langs = resolveLangs(lang, true, false);
		return langs.length ? langs[0] : null;
	}

	/**
	 * 指定した言語で訳文を探す (見つからなければ null)
	 */
	function findValue(key, lang, useFallback){
		var entry = _this.langDb[key];
		if( !entry ){
			return null;
		}
		var langs = resolveLangs(lang, useFallback, useFallback);
		for( var i = 0; i < langs.length; i ++ ){
			var value = entry[langs[i]];
			if( typeof(value) === 'string' && value !== '' ){
				return value;
			}
		}
		return null;
	}

	/**
	 * プレースホルダー ({{ name }}) を、バインドデータの値で置き換える
	 *
	 * 1 回の走査で置き換え、差し込んだ値はもう一度処理しない。
	 * バインドデータは、get() のデータ > options.bind の順で探す (自身の列挙可能なプロパティだけ)。
	 */
	function render(template, bindData, isDefault, key, lang){
		if( _this.options.template === false || template.indexOf('{') < 0 ){
			return template;
		}
		var bind = _this.options.bind;
		var hasBindData = bindData !== null && typeof(bindData) === 'object';
		return template.replace(placeholderPattern(), function(matched, name, offset){
			if( !name ){
				throw reservedSyntaxError(template, offset, describeTemplate(isDefault, key, lang));
			}
			var value;
			if( hasBindData && Object.prototype.propertyIsEnumerable.call(bindData, name) ){
				value = bindData[name];
			}else if( bind && Object.prototype.hasOwnProperty.call(bind, name) ){
				value = bind[name];
			}
			return toPlaceholderValue(value, name, describeTemplate(isDefault, key, lang));
		});
	}

	/**
	 * 指定した言語で get() する
	 */
	function getFor(lang, args){
		var key = toKey(args[0]);
		var parsed = parseGetArgs(args);

		var value = findValue(key, lang, true);
		if( value !== null ){
			return render(value, parsed.bindData, false, key, lang);
		}
		if( typeof(parsed.defaultValue) === 'string' ){
			return render(parsed.defaultValue, parsed.bindData, true, key, lang);
		}
		if( _this.options.onMissing ){
			var missing = _this.options.onMissing(key, lang);
			if( typeof(missing) === 'string' ){
				return missing;
			}
		}
		return key;
	}

	/**
	 * 指定した言語で has() する
	 */
	function hasFor(lang, key, options){
		return findValue(toKey(key), lang, !normalizeHasOptions(options).exact) !== null;
	}

	/**
	 * 言語を固定した、読み取り専用のビュー
	 */
	function createView(lang){
		return Object.freeze(Object.create(Object.prototype, {
			'lang': {'enumerable': true, 'value': lang},
			'defaultLang': {'enumerable': true, 'get': function(){ return _this.defaultLang; }},
			'get': {'enumerable': true, 'value': function(){ return getFor(lang, arguments); }},
			'has': {'enumerable': true, 'value': function(key, options){ return hasFor(lang, key, options); }},
			'resolveLang': {'enumerable': true, 'value': function(l){ return resolveLangFor(l === undefined ? lang : l); }},
			'getLang': {'enumerable': true, 'value': function(){ return lang; }},
			'getDefaultLang': {'enumerable': true, 'value': function(){ return _this.defaultLang; }},
			'getLangList': {'enumerable': true, 'value': function(){ return langList.slice(); }}
		}));
	}

	/**
	 * set Language
	 */
	this.setLang = function(lang){
		_this.lang = (lang === null || lang === undefined) ? null : toStr(lang);
		langIsSet = true;
		return resolveLangFor(_this.lang) !== null;
	}

	/**
	 * get Language
	 */
	this.getLang = function(){
		return _this.lang;
	}

	/**
	 * get default Language
	 */
	this.getDefaultLang = function(){
		return _this.defaultLang;
	}

	/**
	 * 言語を辞書の列名に解決する (省略すると現在の言語)
	 */
	this.resolveLang = function(lang){
		return resolveLangFor(lang === undefined ? _this.lang : lang);
	}

	/**
	 * get language list
	 */
	this.getLangList = function(){
		return langList.slice();
	}

	/**
	 * get word by key
	 */
	this.get = function(){
		return getFor(_this.lang, arguments);
	}

	/**
	 * has word
	 */
	this.has = function(key, options){
		return hasFor(_this.lang, key, options);
	}

	/**
	 * 言語を固定したビューを返す
	 */
	this.withLang = function(lang){
		return createView((lang === null || lang === undefined) ? null : toStr(lang));
	}

	/**
	 * get word list
	 */
	this.getList = function(){
		// すべてのキーに、辞書にあるすべての言語を持たせる (セルがなければ '')
		var rtn = {};
		for( var key in _this.langDb ){
			var entry = {};
			langList.forEach(function(lang){
				setProp(entry, lang, (lang in _this.langDb[key]) ? _this.langDb[key][lang] : '');
			});
			setProp(rtn, key, entry);
		}
		return rtn;
	}

	/**
	 * load additional words
	 */
	this.load = function(src){
		// すべて検証してからマージする (エラーなら辞書を変えない)
		toCsvArrays(src).map(prepareCsv).forEach(function(prepared){
			if( prepared ){
				mergeCsv(prepared);
			}
		});
		return _this;
	}

	this.load(src);
}

LangBank.LangBankError = LangBankError;

module.exports = LangBank;
