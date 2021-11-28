/**
 * langbank.js
 */
module.exports = function(){
	var fs = require('fs');
	var csv = require('csv');

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
		if( !_this.langDb[key] ){
			return '---';
		}
		var lang = _this.lang;
		if( !_this.langDb[key][lang].length ){
			lang = _this.defaultLang;
		}
		if( !_this.langDb[key][lang].length ){
			return '---';
		}
		var rtn = _this.langDb[key][lang];
		var data = _this.options.bind || {};
		data._ENV = this;

		var ejs;
		try{
			ejs = require('ejs');
			rtn = ejs.render(rtn, data, {});
		}catch(e){
			console.error('Disable loading ejs.', e);
		}
		return rtn;
	}

	/**
	 * get word list
	 */
	this.getList = function(){
		return _this.langDb;
	}

	_this.langDb = {};
	var csvSrc = '';
	try {
		csvSrc = fs.readFileSync(_this.pathCsv);
	} catch (e) {
		csvSrc = _this.pathCsv;
	}
	csv.parse(
		csvSrc,
		function(err, csvAry){
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
	);
}
