var assert = require('assert');
var LangBank = require('../libs/LangBank.js');
var cases = require('./testdata/cases.json');

describe('Shared cases (JS/PHP 共通)', function() {

	cases.forEach(function(c) {
		it(c.name, function() {
			// rows はパース済みの CSV 配列。source は testdata のファイル名
			var source = ('rows' in c) ? c.rows : (Array.isArray(c.source) ? c.source : [c.source]).map(function(file){
				return __dirname + '/testdata/' + file;
			});

			// 読み込み時のエラーも検査するため、読み込みから get() までを 1 つの関数にする
			function get(){
				var lb = new LangBank(source, c.options || {});
				lb.setLang(c.lang);
				if( 'args' in c ){
					return lb.get.apply(lb, [c.key].concat(c.args));
				}else if( 'bind' in c && 'default' in c ){
					return lb.get(c.key, c.bind, c.default);
				}else if( 'bind' in c ){
					return lb.get(c.key, c.bind);
				}else if( 'default' in c ){
					return lb.get(c.key, c.default);
				}
				return lb.get(c.key);
			}

			if( 'error' in c ){
				assert.throws(get, function(e){
					assert.ok(e instanceof LangBank.LangBankError);
					assert.strictEqual(e.code, c.error);
					if( 'message' in c ){
						assert.ok(e.message.indexOf(c.message) >= 0, e.message);
					}
					return true;
				});
				return;
			}
			assert.strictEqual(get(), c.expected);
		});
	});

});
