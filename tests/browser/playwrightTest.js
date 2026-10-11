var assert = require('assert');
var bundle = require('./bundle.js');
var scenario = require('./scenario.js');

/**
 * 実際のブラウザ (Chromium と WebKit) で、バンドルを読み込んで使えることを確かめる
 *
 * WebKit は iOS の WKWebView、Chromium は Android の WebView に近い環境として使う。
 * ブラウザは `npx playwright install chromium webkit` でインストールする。
 * インストールされていなければ、テストを飛ばす (環境変数 LANGBANK_REQUIRE_BROWSERS=1 なら失敗にする)。
 */
var playwright = require('playwright');

['chromium', 'webkit'].forEach(function(browserName) {

	describe('Browser: '+browserName, function() {
		this.timeout(60 * 1000);
		var browser = null;

		before(async function() {
			try{
				browser = await playwright[browserName].launch();
			}catch(e){
				if( process.env.LANGBANK_REQUIRE_BROWSERS === '1' ){
					throw e;
				}
				console.log('      '+browserName+' is not available: '+String(e.message).split('\n')[0]);
				this.skip();
			}
		});

		after(async function() {
			if( browser ){
				await browser.close();
			}
		});

		it("バンドルを読み込んで使える", async function() {
			var page = await browser.newPage();
			var errors = [];
			page.on('pageerror', function(e){ errors.push(e.message); });
			await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
			assert.strictEqual(await page.evaluate('typeof Buffer + typeof process + typeof require'), 'undefinedundefinedundefined');
			await page.addScriptTag({'content': bundle({'minify': true}).code});
			var result = await page.evaluate('('+scenario.toString()+')()');
			assert.deepStrictEqual(errors, []);
			assert.deepStrictEqual(result, scenario.expected);
			await page.close();
		});
	});

});
