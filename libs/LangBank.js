/**
 * langbank.js
 */
var fs = null;
try{
	fs = require('fs');
}catch(e){
	// ブラウザなど、fs が使えない環境
}
var Twig = null;
try{
	Twig = require('twig');
}catch(e){
	// Twig を読み込めない環境では、テンプレートを評価せずに返す
}
var csvParse = require('csv/sync').parse;

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
 * 空でない2次元配列か
 */
function is2dArray(value){
	return Array.isArray(value) && value.length > 0 && value.every(Array.isArray);
}

/**
 * CSV文字列をパースする
 */
function parseCsv(src){
	try{
		return csvParse(src, {
			'bom': true,
			'relax_column_count': true,
			'skip_empty_lines': true
		});
	}catch(e){
		throw new LangBankError('CSV_PARSE_ERROR', 'Failed to parse CSV: '+e.message, e);
	}
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
	if( !fs || typeof(fs.existsSync) !== 'function' ){
		throw new LangBankError('FILE_NOT_FOUND', 'File not found (file system is not available): '+src);
	}
	if( !fs.existsSync(src) ){
		throw new LangBankError('FILE_NOT_FOUND', 'File not found: '+src);
	}
	var isFile, content;
	try{
		isFile = fs.statSync(src).isFile();
	}catch(e){
		throw new LangBankError('FILE_READ_ERROR', 'Failed to read file: '+src, e);
	}
	if( !isFile ){
		throw new LangBankError('FILE_NOT_FOUND', 'File not found: '+src);
	}
	try{
		content = fs.readFileSync(src).toString();
	}catch(e){
		throw new LangBankError('FILE_READ_ERROR', 'Failed to read file: '+src, e);
	}
	return parseCsv(content);
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
			return typeof(item) === 'string' || is2dArray(item);
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
var LangBank = function(src, options, callback){
	var _this = this;
	if( typeof(options) === 'function' ){
		callback = options;
		options = {};
	}
	this.options = (options && typeof(options) === 'object') ? options : {};
	this.pathCsv = src;

	this.langDb = Object.create(null);
	this.defaultLang = null;
	this.lang = null;

	var langList = [];
	var langMap = Object.create(null); // 正規化した言語コード => 列名

	/**
	 * パース済みのCSV配列を辞書にマージする
	 */
	function mergeCsv(csvAry){
		csvAry.forEach(function(row){
			if( row === null || row === undefined ){
				return;
			}
			if( !Array.isArray(row) ){
				throw new LangBankError('INVALID_SOURCE', 'Each row of CSV array must be an array.');
			}
			row.forEach(function(cell){
				if( cell !== null && cell !== undefined && typeof(cell) === 'object' || typeof(cell) === 'function' ){
					throw new LangBankError('INVALID_SOURCE', 'Each cell of CSV array must be a scalar value.');
				}
			});
		});
		var rows = csvAry.filter(function(row){
			return Array.isArray(row) && row.some(function(cell){ return toStr(cell) !== ''; });
		});
		if( !rows.length ){
			return;
		}

		var langIdx = [];
		var firstLang = null;
		rows[0].forEach(function(cell, idx){
			var lang = toStr(cell);
			if( idx == 0 || lang === '' ){
				return;
			}
			langIdx[idx] = lang;
			if( firstLang === null ){
				firstLang = lang;
			}
		});
		if( firstLang === null ){
			throw new LangBankError('INVALID_CSV', 'CSV header has no language columns.');
		}

		langIdx.forEach(function(lang){
			if( langList.indexOf(lang) < 0 ){
				langList.push(lang);
			}
			var normalized = normalizeLang(lang);
			if( !(normalized in langMap) ){
				langMap[normalized] = lang;
			}
		});
		if( _this.defaultLang === null ){
			_this.defaultLang = firstLang;
		}
		if( _this.lang === null ){
			_this.lang = firstLang;
		}

		rows.slice(1).forEach(function(row){
			var key = toStr(row[0]);
			if( key === '' ){
				return;
			}
			if( !(key in _this.langDb) ){
				_this.langDb[key] = Object.create(null);
			}
			var entry = _this.langDb[key];
			langIdx.forEach(function(lang, idx){
				var value = toStr(row[idx]);
				if( value !== '' || !(lang in entry) ){
					// 空でないセルだけで後勝ちする
					entry[lang] = value;
				}
			});
		});
	}

	/**
	 * 言語の候補を、辞書の列名のリストにする
	 */
	function resolveLangs(lang, includeDefault){
		var candidates = [];
		function add(l){
			var normalized = normalizeLang(l);
			if( normalized !== '' && candidates.indexOf(normalized) < 0 ){
				candidates.push(normalized);
			}
		}

		if( toStr(lang) !== '' ){
			add(lang);

			var fallback = _this.options.fallback;
			if( fallback && typeof(fallback) === 'object' ){
				Object.keys(fallback).forEach(function(fallbackKey){
					if( normalizeLang(fallbackKey) !== normalizeLang(lang) ){
						return;
					}
					var langs = fallback[fallbackKey];
					(Array.isArray(langs) ? langs : [langs]).forEach(add);
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
	 * 現在の言語で訳文を探す (見つからなければ null)
	 */
	function findValue(key){
		var entry = _this.langDb[key];
		if( !entry ){
			return null;
		}
		var langs = resolveLangs(_this.lang, true);
		for( var i = 0; i < langs.length; i ++ ){
			var value = entry[langs[i]];
			if( typeof(value) === 'string' && value !== '' ){
				return value;
			}
		}
		return null;
	}

	/**
	 * Twig テンプレートを評価する
	 */
	function render(template, bindData, key){
		if( _this.options.twig === false || !Twig || !/\{[{%#]/.test(template) ){
			return template;
		}

		var data = {};
		var globalBind = _this.options.bind || {};
		for( var globalKey in globalBind ){
			data[globalKey] = globalBind[globalKey];
		}
		if( bindData && typeof(bindData) === 'object' ){
			for( var bindDataKey in bindData ){
				data[bindDataKey] = bindData[bindDataKey];
			}
		}
		data._ENV = _this;

		try{
			return Twig.twig({
				'data': template,
				'autoescape': _this.options.autoescape || false,
				'rethrow': true
			}).render(data);
		}catch(e){
			var message = (e && (e.message || e.type)) || String(e);
			throw new LangBankError('TEMPLATE_ERROR', 'Failed to render template of key "'+key+'" (lang: '+_this.lang+'): '+message, e);
		}
	}

	/**
	 * set Language
	 */
	this.setLang = function(lang){
		_this.lang = lang;
		return resolveLangs(lang, false).length > 0;
	}

	/**
	 * get Language
	 */
	this.getLang = function(){
		return _this.lang;
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
	this.get = function(key){
		var bindData = null;
		var defaultValue = null;

		if( arguments.length == 2 ){
			if( typeof(arguments[1]) === 'string' ){
				defaultValue = arguments[1];
			}else{
				bindData = arguments[1];
			}
		}else if( arguments.length >= 3 ){
			bindData = arguments[1];
			defaultValue = arguments[2];
		}

		key = toStr(key);
		var value = findValue(key);
		if( value !== null ){
			return render(value, bindData, key);
		}
		if( typeof(defaultValue) === 'string' ){
			return render(defaultValue, bindData, key);
		}
		if( typeof(_this.options.onMissing) === 'function' ){
			return _this.options.onMissing(key, _this.lang);
		}
		return key;
	}

	/**
	 * has word
	 */
	this.has = function(key){
		return findValue(toStr(key)) !== null;
	}

	/**
	 * get word list
	 */
	this.getList = function(){
		var rtn = {};
		for( var key in _this.langDb ){
			var entry = {};
			for( var lang in _this.langDb[key] ){
				setProp(entry, lang, _this.langDb[key][lang]);
			}
			setProp(rtn, key, entry);
		}
		return rtn;
	}

	/**
	 * load additional words
	 */
	this.load = function(src){
		toCsvArrays(src).forEach(mergeCsv);
		return _this;
	}

	/**
	 * Promise
	 */
	this.ready = function(){
		return Promise.resolve(_this);
	}

	this.load(src);

	if( typeof(callback) === 'function' ){
		setTimeout(function(){
			callback();
		}, 0);
	}
}

LangBank.LangBankError = LangBankError;

module.exports = LangBank;
