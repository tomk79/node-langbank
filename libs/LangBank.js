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
var TwigMarkup = null;
if( Twig && typeof(Twig.extend) === 'function' ){
	// テンプレートで安全な文字列として扱われる Twig.Markup は、extend() からしか取り出せない
	Twig.extend(function(TwigCore){
		TwigMarkup = TwigCore.Markup;
	});
}
var csvParse = require('csv/sync').parse;

/** エラーコード */
var ERROR_CODES = [
	'FILE_NOT_FOUND',
	'FILE_READ_ERROR',
	'INVALID_SOURCE',
	'INVALID_CSV',
	'CSV_PARSE_ERROR',
	'TEMPLATE_ERROR',
	'CIRCULAR_REFERENCE',
	'INVALID_OPTION'
];

/** options.autoescape に指定できるエスケープの戦略 */
var AUTOESCAPE_STRATEGIES = ['html', 'js', 'css', 'url', 'html_attr'];

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
		var rtn = {};
		for( var key in value ){
			setProp(rtn, key, value[key]);
		}
		return rtn;
	},
	'autoescape': function(value){
		if( value === false ){
			return false;
		}
		if( value === true ){
			return 'html';
		}
		if( AUTOESCAPE_STRATEGIES.indexOf(value) < 0 ){
			throw new LangBankError('INVALID_OPTION', 'Option "autoescape" must be false, true, or one of: '+AUTOESCAPE_STRATEGIES.join(', ')+'.');
		}
		return value;
	},
	'twig': function(value){
		if( typeof(value) !== 'boolean' ){
			throw new LangBankError('INVALID_OPTION', 'Option "twig" must be a boolean.');
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
		if( name === '_keys' && Array.isArray(options[name]) ){
			// Twig.js のハッシュリテラル ({'exact': true}) が持つ内部プロパティ。
			// テンプレートの中から _ENV.has() にオプションを渡せるように無視する (テンプレートの外から渡しても同じ)
			return;
		}
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
var LangBank = function(src, options, callback){
	if( !(this instanceof LangBank) ){
		throw new TypeError("Class constructor LangBank cannot be invoked without 'new'");
	}
	var _this = this;
	if( typeof(options) === 'function' ){
		callback = options;
		options = null;
	}
	this.options = normalizeOptions(options);
	this.pathCsv = src;

	this.langDb = Object.create(null);
	this.defaultLang = null;
	this.lang = null;

	var langList = [];
	var langMap = Object.create(null); // 正規化した言語コード => 列名
	var renderStack = []; // 描画中の get() の {key, lang, bind, error}
	var langIsSet = false; // setLang() が呼ばれたか

	/**
	 * パース済みのCSV配列を検証する
	 *
	 * 辞書は変更しない。空のCSVなら null、そうでなければ {rows, header} を返す。
	 * rows は、セルを一度だけ読んで文字列にしたコピー (マージの途中で入力を読み直さない)。
	 * header は、列のインデックス => 言語名 (言語の列だけ)。
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
				if( cell !== null && cell !== undefined && typeof(cell) === 'object' || typeof(cell) === 'function' ){
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
	 * Twig テンプレートを評価する
	 */
	function render(template, bindData, key, lang){
		if( _this.options.twig === false || !Twig || !/\{[{%#]/.test(template) ){
			return template;
		}

		// バインドデータは options.bind < 外側の get() のデータ < この get() のデータ の順で上書きする
		var bind = {};
		var parentBind = renderStack.length ? renderStack[renderStack.length - 1].bind : (_this.options.bind || {});
		for( var parentKey in parentBind ){
			setProp(bind, parentKey, parentBind[parentKey]);
		}
		if( bindData && typeof(bindData) === 'object' ){
			for( var bindDataKey in bindData ){
				setProp(bind, bindDataKey, bindData[bindDataKey]);
			}
		}
		var data = {};
		for( var dataKey in bind ){
			setProp(data, dataKey, bind[dataKey]);
		}
		setProp(data, '_ENV', createView(lang, true));

		var frame = {'key': key, 'lang': lang, 'bind': bind, 'error': null};
		renderStack.push(frame);
		try{
			return Twig.twig({
				'data': template,
				'autoescape': _this.options.autoescape || false,
				'rethrow': true
			}).render(data);
		}catch(e){
			if( frame.error ){
				// 入れ子の get() で起きたエラーは、包み直さずにそのまま投げる
				throw frame.error;
			}
			var message = (e && (e.message || e.type)) || String(e);
			throw new LangBankError('TEMPLATE_ERROR', 'Failed to render template of key "'+key+'" (lang: '+lang+'): '+message, e);
		}finally{
			renderStack.pop();
		}
	}

	/**
	 * 指定した言語で get() する
	 *
	 * 戻り値は {text, trusted}。trusted は、訳文かデフォルト値から作った文字列なら true。
	 * (キーそのものや onMissing の戻り値は、テンプレートの中で安全な文字列として扱わない)
	 */
	function getFor(lang, args){
		var key = toKey(args[0]);
		var parsed = parseGetArgs(args);
		try{
			return getWord(key, parsed.bindData, parsed.defaultValue, lang);
		}catch(e){
			if( e instanceof LangBankError && renderStack.length && !renderStack[renderStack.length - 1].error ){
				// テンプレートの中から呼ばれた場合は、外側の get() にエラーを伝える
				renderStack[renderStack.length - 1].error = e;
			}
			throw e;
		}
	}

	/**
	 * get() の本体
	 */
	function getWord(key, bindData, defaultValue, lang){
		var path = renderStack.map(function(frame){ return frame.key; });
		if( path.indexOf(key) >= 0 ){
			throw new LangBankError('CIRCULAR_REFERENCE', 'Circular reference: '+path.slice(path.indexOf(key)).concat([key]).join(' -> '));
		}

		var value = findValue(key, lang, true);
		if( value !== null ){
			return {'text': render(value, bindData, key, lang), 'trusted': true};
		}
		if( typeof(defaultValue) === 'string' ){
			return {'text': render(defaultValue, bindData, key, lang), 'trusted': true};
		}
		if( _this.options.onMissing ){
			var missing = _this.options.onMissing(key, lang);
			if( typeof(missing) === 'string' ){
				return {'text': missing, 'trusted': false};
			}
		}
		return {'text': key, 'trusted': false};
	}

	/**
	 * 指定した言語で has() する
	 */
	function hasFor(lang, key, options){
		return findValue(toKey(key), lang, !normalizeHasOptions(options).exact) !== null;
	}

	/**
	 * 言語を固定した、読み取り専用のビュー
	 *
	 * forTemplate が true なら、テンプレートに _ENV として渡す。
	 * このとき autoescape が有効なら、訳文やデフォルト値から作った get() の結果を安全な文字列 (Twig.Markup) で返し、
	 * 二重にエスケープされないようにする。キーそのものや onMissing の戻り値は、外側のテンプレートでエスケープさせる。
	 */
	function createView(lang, forTemplate){
		return Object.freeze(Object.create(forTemplate ? null : Object.prototype, {
			'lang': {'enumerable': true, 'value': lang},
			'defaultLang': {'enumerable': true, 'get': function(){ return _this.defaultLang; }},
			'get': {'enumerable': true, 'value': function(){
				var result = getFor(lang, arguments);
				if( forTemplate && result.trusted && TwigMarkup && _this.options.autoescape ){
					return TwigMarkup(result.text);
				}
				return result.text;
			}},
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
		return getFor(_this.lang, arguments).text;
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
		return createView((lang === null || lang === undefined) ? null : toStr(lang), false);
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

	if( typeof(callback) === 'function' ){
		setTimeout(function(){
			callback();
		}, 0);
	}
}

LangBank.LangBankError = LangBankError;

module.exports = LangBank;
