var assert = require('assert');
var parseCsv = require('../libs/parseCsv.js');
var cases = require('./testdata/csv_cases.json');

describe('CSV parser (PHP の fgetcsv() と同じ結果)', function() {

	// csv_cases.json の rows は、PHP版の parseCsv() (fgetcsv()) が返した結果
	cases.forEach(function(c) {
		it(c.name, function() {
			assert.deepStrictEqual(parseCsv(c.csv), c.rows);
		});
	});

});
