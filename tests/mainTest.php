<?php
/**
 * test for tomk79/langbank
 */
class mainTest extends PHPUnit\Framework\TestCase{
	private $listCsv;
	private $csvCode;

	public function setup() : void{
		mb_internal_encoding('UTF-8');
		$this->listCsv = __DIR__.'/testdata/list_twig.csv';
		$this->csvCode = '"","en","ja","anylang"'."\n".'"goodmorning","Good Morning!","おはよう！","good morning in anylang"'."\n".'"helloworld","Hello World","こんにちわ世界","helloworld in anylang"';
	}

	private function assertLangBankError($fn, $code){
		try{
			$fn();
		}catch( \tomk79\LangBankException $e ){
			$this->assertInstanceOf(\RuntimeException::class, $e);
			$this->assertSame($code, $e->getErrorCode());
			return $e;
		}
		$this->fail('LangBankException ('.$code.') expected.');
	}

	/**
	 * No Options
	 */
	public function testNoOptions(){

		$lb = new tomk79\LangBank($this->listCsv);

		// get(), setLang()
		$lb->setLang("en");
		$this->assertSame($lb->getLang(), 'en');
		$this->assertSame($lb->get('hello'), 'Hello');
		$this->assertSame($lb->get('no-ja1'), 'NoJa1');
		$this->assertSame($lb->get('no-ja2'), 'NoJa2');
		$this->assertSame($lb->get('no-en1'), 'no-en1');
		$this->assertSame($lb->get('undefinedKey'), 'undefinedKey');
		$this->assertSame($lb->get('undefinedKey', 'default value'), 'default value');

		$lb->setLang("ja");
		$this->assertSame($lb->get('hello'), 'こんにちわ');
		$this->assertSame($lb->get('no-ja1'), 'NoJa1');
		$this->assertSame($lb->get('no-ja2'), 'NoJa2');
		$this->assertSame($lb->get('no-en1'), 'no-en1');
		$this->assertSame($lb->get('undefinedKey'), 'undefinedKey');
		$this->assertSame($lb->get('undefinedKey', 'default value'), 'default value');

		$lb->setLang("anylang");
		$this->assertSame($lb->get('goodmorning'), 'good morning in anylang');
		$this->assertSame($lb->get('hello'), 'hello in anylang');

		// getList()
		$list = $lb->getList();
		$this->assertSame($list['hello']['ja'], 'こんにちわ');
		$this->assertSame($list['hello']['en'], 'Hello');

	}

	/**
	 * Width Options
	 */
	public function testWithOptions(){

		$lb = new tomk79\LangBank(
			$this->listCsv,
			array(
				"bind" => array(
					"test1" => "bind test 1",
					"test2" => "bind test 2"
				)
			)
		);

		$lb->setLang("en");
		$this->assertSame($lb->get('hello'), 'Hello');

		$lb->setLang("ja");
		$this->assertSame($lb->get('hello'), 'こんにちわ');

		$list = $lb->getList();
		$this->assertSame($list['hello']['ja'], 'こんにちわ');
		$this->assertSame($list['hello']['en'], 'Hello');

		// bind test
		$this->assertSame($lb->get('bind1'), 'test bind test 1');
		$this->assertSame($lb->get('bind2'), 'ja');
		$this->assertSame($lb->get('bind3'), 'en');
		$this->assertSame($lb->get('bind4'), 'こんにちわ');

		$this->assertSame($lb->get('bind1', (array) array("test1" => "local bind test 1")), 'test local bind test 1');
		$this->assertSame($lb->get('bind1', (object) array("test1" => "local bind test 1")), 'test local bind test 1');
		$this->assertSame($lb->get('bind1', (object) array("test1" => "local bind test 2"), "test local template: {{ test1 }}"), 'test local bind test 2');
		$this->assertSame($lb->get('undefined', (object) array("test1" => "local bind test 3"), "test local template: {{ test1 }}"), 'test local template: local bind test 3');

		// バインドデータが後の呼び出しに残らない
		$this->assertSame($lb->get('bind1'), 'test bind test 1');
	}

	/**
	 * as CSV code
	 */
	public function testAsCsvCode(){
		$lb = new tomk79\LangBank( $this->csvCode );

		$lb->setLang("en");
		$this->assertSame($lb->get('helloworld'), 'Hello World');

		$lb->setLang("ja");
		$this->assertSame($lb->get('helloworld'), 'こんにちわ世界');

		$list = $lb->getList();
		$this->assertSame($list['helloworld']['ja'], 'こんにちわ世界');
		$this->assertSame($list['helloworld']['en'], 'Hello World');

		// CRLF
		$lb = new tomk79\LangBank( str_replace("\n", "\r\n", $this->csvCode) );
		$lb->setLang("ja");
		$this->assertSame($lb->get('helloworld'), 'こんにちわ世界');

		// BOM
		$lb = new tomk79\LangBank( "\xEF\xBB\xBF".$this->csvCode );
		$this->assertSame(array('en', 'ja', 'anylang'), $lb->getLangList());
		$this->assertSame($lb->get('helloworld'), 'Hello World');
	}

	/**
	 * CR だけの改行, Shift_JIS のファイル
	 */
	public function testLineBreaksAndEncodings(){
		$lb = new tomk79\LangBank( str_replace("\n", "\r", $this->csvCode) );
		$lb->setLang("ja");
		$this->assertSame(array('en', 'ja', 'anylang'), $lb->getLangList());
		$this->assertSame('こんにちわ世界', $lb->get('helloworld'));

		$lb = new tomk79\LangBank( __DIR__.'/testdata/sjis.csv' );
		$lb->setLang("ja");
		$this->assertSame('こんにちは', $lb->get('hello'));
		$this->assertSame('表', $lb->get('table'));

		// バックスラッシュはエスケープ文字ではない
		$lb = new tomk79\LangBank( '"","en"'."\n".'"path","C:\\dir\\"' );
		$this->assertSame('C:\\dir\\', $lb->get('path'));
	}

	/**
	 * null or undefined
	 */
	public function testNull(){
		foreach( array(null, '', array()) as $src ){
			$lb = new tomk79\LangBank( $src );
			$this->assertSame(array(), $lb->getList());
			$this->assertSame(array(), $lb->getLangList());
			$this->assertNull($lb->getLang());
			$this->assertSame('helloworld', $lb->get('helloworld'));
			$this->assertSame('undefined', $lb->get('helloworld', 'undefined'));
		}
	}

	/**
	 * パース済みの CSV 配列, 読み込み元の配列, load()
	 */
	public function testSources(){
		$lb = new tomk79\LangBank(array(array("", "en", "ja"), array("k", "v", "値")));
		$lb->setLang('ja');
		$this->assertSame('値', $lb->get('k'));

		$lb = new tomk79\LangBank(array(
			$this->listCsv,
			'"","en"'."\n".'"fromString","From String"',
			array(array("", "en"), array("fromArray", "From Array")),
		));
		$this->assertSame('Hello', $lb->get('hello'));
		$this->assertSame('From String', $lb->get('fromString'));
		$this->assertSame('From Array', $lb->get('fromArray'));

		$lb = new tomk79\LangBank(__DIR__.'/testdata/merge_a.csv');
		$this->assertSame($lb, $lb->load(__DIR__.'/testdata/merge_b.csv'));
		$lb->setLang('ja');
		$this->assertSame('こんにちは', $lb->get('hello'));
		$this->assertSame('en', $lb->defaultLang);
		$this->assertSame(array('en', 'ja', 'fr'), $lb->getLangList());

		// load() はデフォルト言語と現在の言語を変えない
		$lb = new tomk79\LangBank(null);
		$lb->load(__DIR__.'/testdata/merge_b.csv');
		$this->assertSame('ja', $lb->defaultLang);
		$this->assertSame('ja', $lb->getLang());
		$lb->setLang('fr');
		$lb->load(__DIR__.'/testdata/merge_a.csv');
		$this->assertSame('ja', $lb->defaultLang);
		$this->assertSame('fr', $lb->getLang());
	}

	/**
	 * Errors
	 */
	public function testErrors(){
		$this->assertLangBankError(function(){
			new tomk79\LangBank(__DIR__.'/testdata/typo.csv');
		}, 'FILE_NOT_FOUND');

		$this->assertLangBankError(function(){
			new tomk79\LangBank('"","en"');
		}, 'FILE_NOT_FOUND');

		$lb = new tomk79\LangBank($this->listCsv);
		$this->assertLangBankError(function() use ($lb){
			$lb->load(__DIR__.'/testdata/typo.csv');
		}, 'FILE_NOT_FOUND');

		foreach( array(123, true, new \stdClass()) as $src ){
			$this->assertLangBankError(function() use ($src){
				new tomk79\LangBank($src);
			}, 'INVALID_SOURCE');
		}

		foreach( array(
			array($this->listCsv, null, 1),
			array(array("", "en"), "row"),
			array(array("", "en"), array("k", array("a", "b"))),
		) as $src ){
			$this->assertLangBankError(function() use ($src){
				new tomk79\LangBank($src);
			}, 'INVALID_SOURCE');
		}
		$lb = new tomk79\LangBank(array(array("", "en"), null, array(), array("k", 1)));
		$this->assertSame('1', $lb->get('k'));

		// 文字列以外のデフォルト値は指定なしとして扱う
		$this->assertSame('nope', $lb->get('nope', null, false));
		$this->assertSame('nope', $lb->get('nope', null, 0));

		$this->assertLangBankError(function(){
			new tomk79\LangBank('""'."\n".'"k"');
		}, 'INVALID_CSV');

		$lb = new tomk79\LangBank(__DIR__.'/testdata/escape.csv');
		$e = $this->assertLangBankError(function() use ($lb){
			$lb->get('bad');
		}, 'TEMPLATE_ERROR');
		$this->assertStringContainsString('bad', $e->getMessage());
		$this->assertNotNull($e->getPrevious());
	}

	/**
	 * onMissing
	 */
	public function testOnMissing(){
		$log = array();
		$lb = new tomk79\LangBank($this->listCsv, array(
			'onMissing' => function($key, $lang) use (&$log){
				$log[] = array($key, $lang);
				return '---';
			},
		));
		$lb->setLang('ja');
		$this->assertSame('---', $lb->get('undefinedKey'));
		$this->assertSame('---', $lb->get('no-en1'));
		$this->assertSame('default', $lb->get('undefinedKey', 'default'));
		$this->assertSame('こんにちわ', $lb->get('hello'));
		$this->assertSame(array(array('undefinedKey', 'ja'), array('no-en1', 'ja')), $log);

		$lb = new tomk79\LangBank($this->listCsv, array(
			'onMissing' => function($key){ return '{{ '.$key.' }}'; },
		));
		$this->assertSame('{{ undefinedKey }}', $lb->get('undefinedKey'));
	}

	/**
	 * onMissing が文字列以外を返したらキーを返す
	 */
	public function testOnMissingNotString(){
		foreach( array(null, false, 0, array()) as $ret ){
			$lb = new tomk79\LangBank($this->listCsv, array(
				'onMissing' => function() use ($ret){ return $ret; },
			));
			$this->assertSame('undefinedKey', $lb->get('undefinedKey'));
		}
		$lb = new tomk79\LangBank($this->listCsv, array(
			'onMissing' => function(){},
		));
		$this->assertSame('undefinedKey', $lb->get('undefinedKey'));
		$lb = new tomk79\LangBank($this->listCsv, array(
			'onMissing' => function(){ return ''; },
		));
		$this->assertSame('', $lb->get('undefinedKey'));
	}

	/**
	 * エラーの後も描画中の状態が残らない
	 */
	public function testStateAfterError(){
		$lb = new tomk79\LangBank(__DIR__.'/testdata/env.csv', array('bind' => array('name' => 'Global')));
		$this->assertLangBankError(function() use ($lb){
			$lb->get('loop_a', array('name' => 'Tom'));
		}, 'CIRCULAR_REFERENCE');
		$this->assertSame('Hello, Global Welcome!', $lb->get('welcome'));
		$this->assertLangBankError(function() use ($lb){
			$lb->get('outer', array('name' => 'Tom'));
		}, 'TEMPLATE_ERROR');
		$this->assertSame('Hello, Global / Hello, Global', $lb->get('twice'));
	}

	/**
	 * _ENV からファイルを読み込めない
	 */
	public function testEnvCannotLoad(){
		$lb = new tomk79\LangBank('"","en"'."\n".'"x","{{ _ENV.load(path) }}"'."\n");
		try{
			$lb->get('x', array('path' => __DIR__.'/testdata/merge_b.csv'));
		}catch( \Throwable $e ){
		}
		$this->assertSame(array('en'), $lb->getLangList());
		$this->assertFalse($lb->has('onlyb'));
	}

	/**
	 * Languages
	 */
	public function testLanguages(){
		$lb = new tomk79\LangBank(__DIR__.'/testdata/regional.csv');
		$this->assertTrue($lb->setLang('ja'));
		$this->assertTrue($lb->setLang('ja_JP'));
		$this->assertTrue($lb->setLang('EN-us'));
		$this->assertFalse($lb->setLang('xx'));
		$this->assertSame('xx', $lb->getLang());
		$this->assertSame('Hello', $lb->get('hello'));
		$this->assertSame(array('en', 'en-US', 'ja', 'zh-Hant', 'pt'), $lb->getLangList());

		// 表記の揺れは最初の表記にまとめる
		$lb = new tomk79\LangBank(array(__DIR__.'/testdata/header_case_a.csv', __DIR__.'/testdata/header_case_b.csv'));
		$this->assertSame(array('en', 'ja_JP'), $lb->getLangList());
		$this->assertSame(array('en' => 'Bye', 'ja_JP' => 'さようなら'), $lb->getList()['bye']);

		// getDefaultLang()
		$lb = new tomk79\LangBank(null);
		$this->assertNull($lb->getDefaultLang());
		$lb->load(__DIR__.'/testdata/regional.csv');
		$lb->setLang('ja');
		$this->assertSame('en', $lb->getDefaultLang());

		$lb = new tomk79\LangBank(__DIR__.'/testdata/regional.csv', array('fallback' => array('zh-HK' => array('zh-Hant'))));
		$this->assertTrue($lb->setLang('zh-HK'));

		$lb = new tomk79\LangBank($this->listCsv);
		$lb->setLang('ja');
		$this->assertTrue($lb->has('hello'));
		$this->assertTrue($lb->has('no-ja1'));
		$this->assertFalse($lb->has('no-en1'));
		$this->assertFalse($lb->has('undefinedKey'));
	}

}
