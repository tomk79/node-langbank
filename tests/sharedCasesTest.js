var assert = require('assert');
var LangBank = require('../libs/LangBank.js');
var cases = require('./testdata/cases.json');

describe('Shared cases (JS/PHP 共通)', function() {

	cases.forEach(function(c) {
		it(c.name, function() {
			var source = (Array.isArray(c.source) ? c.source : [c.source]).map(function(file){
				return __dirname + '/testdata/' + file;
			});
			var lb = new LangBank(source, c.options || {});
			lb.setLang(c.lang);

			function get(){
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
