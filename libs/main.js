/**
 * langbank.js
 */
module.exports = function( pathCsv, callback ){
	var csv = require('csv');
	var fs = require('fs');
	var Promise = require("es6-promise").Promise;
	callback = callback || function(){};

	var _this = this;
	this.pathCsv = pathCsv;
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
	 * get word by key
	 */
	this.get = function(key){
		if( !_this.langDb[key] ){ return false; }
		return _this.langDb[key][_this.lang];
	}

	/**
	 * get word list
	 */
	this.getList = function(){
		return _this.langDb;
	}

	_this.langDb = {};
	csv.parse(
		fs.readFileSync(_this.pathCsv),
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
