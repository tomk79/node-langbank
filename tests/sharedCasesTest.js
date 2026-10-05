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

			var result;
			if( 'bind' in c && 'default' in c ){
				result = lb.get(c.key, c.bind, c.default);
			}else if( 'bind' in c ){
				result = lb.get(c.key, c.bind);
			}else if( 'default' in c ){
				result = lb.get(c.key, c.default);
			}else{
				result = lb.get(c.key);
			}
			assert.strictEqual(result, c.expected);
		});
	});

});
