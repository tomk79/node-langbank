/**
 * langbank.js
 */
module.exports = function(){
	var _this = this;
	this.options = {};
	this.pathCsv = arguments[0];
	if(arguments.length == 2){
		callback = arguments[arguments.length-1] || function(){};
	}else if(arguments.length == 3){
		this.options = arguments[1];
		callback = arguments[arguments.length-1] || function(){};
	}else{
		callback = function(){};
	}

	this.langDb = {};
	this.defaultLang = null;
	this.lang = null;

	/**
	 * set Language
	 */
	this.setLang = function(lang){
		this.lang = lang;
		return true;
	}

	/**
	 * get Language
	 */
	this.getLang = function(){
		return this.lang;
	}

	/**
	 * get word by key
	 */
	this.get = function(key){
		var bindData = {};
		var defaultValue = '---';

		if( arguments.length == 2 ){
			if( typeof(arguments[1]) == typeof('string') ){
				defaultValue = arguments[1];
			}else{
				bindData = arguments[1];
			}
		}else if( arguments.length == 3 ){
			bindData = arguments[1];
			defaultValue = arguments[2];
		}

		if( !defaultValue ){
			defaultValue = '---';
		}
		if( !_this.langDb[key] ){
			return defaultValue;
		}
		var lang = _this.lang;
		if( !_this.langDb[key][lang] || !_this.langDb[key][lang].length ){
			lang = _this.defaultLang;
		}
		if( !_this.langDb[key][lang] || !_this.langDb[key][lang].length ){
			return defaultValue;
		}
		var rtn = _this.langDb[key][lang];
		var data = _this.options.bind || {};
		data._ENV = this;

		var Twig, twig;
		try{
			Twig = require('twig'), // Twig module
			twig = Twig.twig;

			rtn = new twig({
				'data': rtn
			}).render(data);
		}catch(e){
			console.error('Disable loading Twig.', e);
		}
		return rtn;
	}

	/**
	 * get word list
	 */
	this.getList = function(){
		return _this.langDb;
	}


	/**
	 * パース済みのCSV配列を処理する
	 */
	function procParsedCsvAry(csvAry, callback){
		var langIdx=[];

		for( var i1 in csvAry ){
			// console.log(csvAry[i1]);
			if(i1 == 0){
				for( var i2 in csvAry[i1] ){
					if(i2 == 0){
						continue;
					}
					if(i2 == 1){
						_this.defaultLang = csvAry[i1][i2];
						_this.lang = csvAry[i1][i2];
					}
					langIdx[i2] = csvAry[i1][i2];
				}
			}else{
				_this.langDb[csvAry[i1][0]] = {};
				for( var i2 in csvAry[i1] ){
					if(i2 == 0){continue;}
					_this.langDb[csvAry[i1][0]][langIdx[i2]] = csvAry[i1][i2];
				}
			}
		}
		// console.log(_this.langDb);
		callback();

	}


	_this.langDb = {};
	var csvSrc = '';
	try {
		var fs = require('fs');
		if( fs && typeof(_this.pathCsv) === typeof('') && _this.pathCsv.length && fs.existsSync(_this.pathCsv) ){
			csvSrc = fs.readFileSync(_this.pathCsv).toString();
		}else if( typeof(_this.pathCsv) === typeof('') ){
			csvSrc = _this.pathCsv;
		}else{
			csvSrc = _this.pathCsv;
		}
	} catch (e) {
		csvSrc = _this.pathCsv;
	}

	if( typeof(csvSrc) !== typeof([]) ){
		var csv = require('csv');
		csv.parse(
			csvSrc,
			function(err, csvAry){
				procParsedCsvAry(csvAry, function(){
					callback();
				});
			}
		);
	}else{
		setTimeout(function(){
			procParsedCsvAry(csvSrc, function(){
				callback();
			});
		}, 1);
	}
}
