<?php
/**
 * test for tomk79/langbank
 */
class mainTest extends PHPUnit_Framework_TestCase{
	private $fs;

	public function setup(){
		mb_internal_encoding('UTF-8');
		$this->fs = new tomk79\filesystem();
	}

	/**
	 * No Options
	 */
	public function testNoOptions(){

		// PHP版は、ejs ではなく twig に対応
		$lb = new tomk79\LangBank(__DIR__.'/testdata/list_twig.csv');

		// get(), setLang()
		$lb->setLang("en");
		$this->assertSame($lb->getLang(), 'en');
		$this->assertSame($lb->get('hello'), 'Hello');
		$this->assertSame($lb->get('no-ja1'), 'NoJa1');
		$this->assertSame($lb->get('no-ja2'), 'NoJa2');
		$this->assertSame($lb->get('no-en1'), '---');
		$this->assertSame($lb->get('undefinedKey'), '---');

		$lb->setLang("ja");
		$this->assertSame($lb->get('hello'), 'こんにちわ');
		$this->assertSame($lb->get('no-ja1'), 'NoJa1');
		$this->assertSame($lb->get('no-ja2'), 'NoJa2');
		$this->assertSame($lb->get('no-en1'), '---');
		$this->assertSame($lb->get('undefinedKey'), '---');

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
			__DIR__.'/testdata/list_twig.csv', // PHP版は、ejs ではなく twig に対応
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

	}

	/**
	 * as CSV code
	 */
	public function testAsCsvCode(){
		// ※PHP版は、ファイルからの読み込みのみに対応
		// $lb = new tomk79\LangBank( '"","en","ja","anylang"'+"\n"+'"goodmorning","Good Morning!","おはよう！","good morning in anylang"'+"\n"+'"helloworld","Hello World","こんにちわ世界","helloworld in anylang"' );

		// $lb->setLang("en");
		// $this->assertSame($lb->get('helloworld'), 'Hello World');

		// $lb->setLang("ja");
		// $this->assertSame($lb->get('helloworld'), 'こんにちわ世界');

		// $list = $lb->getList();
		// $this->assertSame($list['helloworld']['ja'], 'こんにちわ世界');
		// $this->assertSame($list['helloworld']['en'], 'Hello World');
	}

}
