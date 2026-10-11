<?php
/**
 * test for tomk79/langbank
 */
class mainTest extends PHPUnit\Framework\TestCase{
	private $listCsv;
	private $csvCode;

	public function setup() : void{
		mb_internal_encoding('UTF-8');
		$this->listCsv = __DIR__.'/testdata/list.csv';
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

		// 予約した構文は読み込み時に TEMPLATE_ERROR
		$e = $this->assertLangBankError(function(){
			new tomk79\LangBank('"","en","ja"'."\n".'"ok","OK",""'."\n".'"bad","OK","{% if x %}"'."\n");
		}, 'TEMPLATE_ERROR');
		$this->assertSame('Unsupported syntax in the word of key "bad" (lang: ja): "{% if x %}". Only placeholders like {{ name }} are supported.', $e->getMessage());
		$lb = new tomk79\LangBank($this->listCsv);
		$this->assertLangBankError(function() use ($lb){
			$lb->load(array(array('', 'en'), array('bad', '{{ a.b }}')));
		}, 'TEMPLATE_ERROR');
		$this->assertFalse($lb->has('bad'));

		// 予約した構文のデフォルト値は get() で TEMPLATE_ERROR
		$lb->setLang('ja');
		$e = $this->assertLangBankError(function() use ($lb){
			$lb->get('nokey', array('name' => 'x'), '{# comment #}');
		}, 'TEMPLATE_ERROR');
		$this->assertSame('Unsupported syntax in the default value of key "nokey" (lang: ja): "{# comment #}". Only placeholders like {{ name }} are supported.', $e->getMessage());
		$this->assertSame('こんにちわ', $lb->get('hello', null, '{% x %}'));

		// メッセージは文字の途中で切らない
		$e = $this->assertLangBankError(function(){
			new tomk79\LangBank(array(array('', 'en'), array('k', 'あ{{ いいいいいいいいいいいいいいいいいいいいい }}')));
		}, 'TEMPLATE_ERROR');
		$this->assertStringContainsString('"{{ いいいいいいいいいいいいいいいいい"', $e->getMessage());

		// 不正な CSV でもエラーにしない (NodeJS版と同じ規則で読む)
		$lb = new tomk79\LangBank('"","en"'."\n".'"k","v'."\n".'"k2","v2"');
		$this->assertSame(array('k' => array('en' => "v\nk2\"")), $lb->getList());
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

		// onMissing の戻り値は置き換えない
		$lb = new tomk79\LangBank($this->listCsv, array(
			'onMissing' => function($key){ return '{{ '.$key.' }} {% x %}'; },
		));
		$this->assertSame('{{ undefinedKey }} {% x %}', $lb->get('undefinedKey', array('undefinedKey' => 'X')));

		// onMissing が投げた例外は、そのまま投げる
		$boom = new \Exception('boom');
		$lb = new tomk79\LangBank($this->listCsv, array(
			'onMissing' => function() use ($boom){ throw $boom; },
		));
		try{
			$lb->get('nokey');
			$this->fail('Exception expected.');
		}catch( \Exception $e ){
			$this->assertSame($boom, $e);
		}
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
	 * プレースホルダーの値の型
	 */
	public function testPlaceholderValueTypes(){
		$lb = new tomk79\LangBank('"","en"'."\n".'"k","[{{ x }}]"'."\n");
		$stringable = new class{ public function __toString(){ return 'S'; } };
		foreach( array(array(), array('a'), new \stdClass(), $stringable, fopen('php://memory', 'r')) as $value ){
			$e = $this->assertLangBankError(function() use ($lb, $value){
				$lb->get('k', array('x' => $value));
			}, 'TEMPLATE_ERROR');
			$this->assertStringContainsString('Unsupported type of the value "x"', $e->getMessage());
		}
		// 数値は (string) と同じ
		$this->assertSame('[0.3]', $lb->get('k', array('x' => 0.1 + 0.2)));
		$this->assertSame('[1.0E+20]', $lb->get('k', array('x' => 1e20)));
		$this->assertSame('[]', $lb->get('k', array('x' => null)));

		// options.bind の値は、使うときに調べる
		$lb = new tomk79\LangBank('"","en"'."\n".'"k","[{{ x }}]"'."\n".'"other","[{{ y }}]"'."\n", array('bind' => array('x' => array())));
		$this->assertSame('[]', $lb->get('other'));
		$this->assertLangBankError(function() use ($lb){ $lb->get('k'); }, 'TEMPLATE_ERROR');

		// バインドデータは、配列の要素、オブジェクトの公開プロパティ、Traversable の要素
		$lb = new tomk79\LangBank('"","en"'."\n".'"k","[{{ x }}][{{ y }}]"'."\n");
		$obj = new class{ public $x = 'pub'; protected $y = 'protected'; };
		$this->assertSame('[pub][]', $lb->get('k', $obj));
		$this->assertSame('[gen][]', $lb->get('k', (function(){ yield 'x' => 'gen'; })()));
		$this->assertSame('[][]', $lb->get('k', new \ArrayObject(array())));

		// LangBank (とそのサブクラス) のインスタンスでも、公開プロパティだけを読む
		$lb = new tomk79\LangBank('"","en"'."\n".'"k","[{{ secret }}][{{ options }}][{{ langDb }}][{{ pub }}][{{ lang }}]"'."\n");
		$sub = new class extends tomk79\LangBank{ protected $secret = 'hidden'; public $pub = 'P'; };
		$sub->setLang('xx');
		$this->assertSame('[][][][P][xx]', $lb->get('k', $sub));
		$this->assertSame('[][][][][en]', $lb->get('k', $lb));
		$lb2 = new tomk79\LangBank('"","en"'."\n".'"k","[{{ secret }}][{{ options }}][{{ pub }}]"'."\n", array('bind' => $sub));
		$this->assertSame('[][][P]', $lb2->get('k'));

		// 参照のプロパティや要素も、値としてコピーする (元の変数を書き換えず、後から変えても影響しない)
		foreach( array('object', 'array') as $type ){
			$value = 'before';
			if( $type === 'object' ){
				$bind = new \stdClass();
				$bind->x =& $value;
			}else{
				$bind = array('x' => &$value);
			}
			$lb = new tomk79\LangBank(array(array('', 'en'), array('k', '{{ x }}')), array('bind' => $bind));
			$this->assertSame('override', $lb->get('k', array('x' => 'override')), $type);
			$this->assertSame('before', $value, $type);
			$this->assertSame('before', $lb->get('k'), $type);
			$value = 'changed';
			$this->assertSame('before', $lb->get('k'), $type);

			// get() のバインドデータも同じ
			$lb = new tomk79\LangBank(array(array('', 'en'), array('k', '{{ x }}')), array('bind' => array('x' => 'global')));
			$value = 'local';
			$this->assertSame('local', $lb->get('k', $bind), $type);
			$this->assertSame('local', $value, $type);
			$this->assertSame('global', $lb->get('k'), $type);
		}

		// getList() と has() は訳文をそのまま扱う
		$lb = new tomk79\LangBank(__DIR__.'/testdata/placeholders.csv');
		$this->assertSame('Hi {{ name }}', $lb->getList()['greet']['en']);
		$this->assertTrue($lb->has('greet'));
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

	/**
	 * get() はラッパー関数から引数をそのまま渡せる
	 */
	public function testGetArgsFromWrapper(){
		$lb = new tomk79\LangBank($this->listCsv);
		$t = function( $key, $a = null, $b = null ) use ($lb){
			return $lb->get($key, $a, $b);
		};
		$this->assertSame('DEF', $t('undefinedKey', 'DEF'));
		$this->assertSame('test x', $t('bind1', array('test1' => 'x')));
		$this->assertSame('D', $t('undefinedKey', null, 'D'));
		$this->assertSame('Hello', $t('hello'));
	}

	/**
	 * 不正なオプションは INVALID_OPTION
	 */
	public function testInvalidOptions(){
		foreach( array(
			array('unknown' => 1),
			array('onmissing' => function(){}),
			array('x'),
			array('bind' => 'x'),
			array('template' => 'false'),
			array('template' => 0),
			array('twig' => false),
			array('autoescape' => 'html'),
			array('autoescape' => false),
			array('onMissing' => 'no_such_function'),
			array('fallback' => 'ja'),
			array('fallback' => array('ja' => 1)),
			array('fallback' => array('ja' => array('en', 1))),
		) as $options ){
			$this->assertLangBankError(function() use ($options){
				new tomk79\LangBank($this->listCsv, $options);
			}, 'INVALID_OPTION');
		}
		$e = $this->assertLangBankError(function(){
			new tomk79\LangBank($this->listCsv, array('onmissing' => function(){}));
		}, 'INVALID_OPTION');
		$this->assertStringContainsString('onmissing', $e->getMessage());

		// 配列以外は TypeError
		try{
			new tomk79\LangBank($this->listCsv, 'x');
			$this->fail('TypeError expected.');
		}catch( \TypeError $e ){
		}

		// null は指定なしとして扱う
		$lb = new tomk79\LangBank($this->listCsv, array('bind' => null, 'template' => null, 'onMissing' => null, 'fallback' => null));
		$this->assertSame('undefinedKey', $lb->get('undefinedKey'));
		$lb = new tomk79\LangBank($this->listCsv, null);
		$this->assertSame('Hello', $lb->get('hello'));

		// template: true は既定と同じ
		$lb = new tomk79\LangBank(__DIR__.'/testdata/placeholders.csv', array('template' => true));
		$this->assertSame('Hi Tom', $lb->get('greet', array('name' => 'Tom')));

		// fallback の値には文字列も書ける
		$lb = new tomk79\LangBank(__DIR__.'/testdata/regional.csv', array('fallback' => array('zh-HK' => 'zh-Hant')));
		$lb->setLang('zh-HK');
		$this->assertSame('你好', $lb->get('hello'));
	}

	/**
	 * options.bind は構築時に列挙してコピーする
	 */
	public function testBindOptionIsCopied(){
		$csv = '"","en"'."\n".'"k","[{{ name }}]"'."\n";

		// Traversable は列挙する (get() のバインドデータと同じ)
		$generator = (function(){ yield 'name' => 'Gen'; })();
		$lb = new tomk79\LangBank($csv, array('bind' => $generator));
		$this->assertSame('[Gen]', $lb->get('k'));
		$this->assertSame('[Gen]', $lb->get('k'));

		// オブジェクトは公開プロパティを読む
		$obj = new \stdClass();
		$obj->name = 'Obj';
		$lb = new tomk79\LangBank($csv, array('bind' => $obj));
		$this->assertSame('[Obj]', $lb->get('k'));

		// 構築した後にトップレベルの項目を書き換えても影響しない
		$obj->name = 'Changed';
		$this->assertSame('[Obj]', $lb->get('k'));

		// 構築した後に元の配列を書き換えても影響しない
		$bind = array('name' => 'A1');
		$lb = new tomk79\LangBank($csv, array('bind' => $bind));
		$bind['name'] = 'A2';
		$this->assertSame('[A1]', $lb->get('k'));

		// options 全体の null は指定なし
		$lb = new tomk79\LangBank($csv, null);
		$this->assertTrue($lb->has('k', null));
	}

	/**
	 * LangBankView は直接生成できない
	 */
	public function testViewCannotBeConstructed(){
		$this->assertTrue((new \ReflectionMethod(tomk79\LangBankView::class, '__construct'))->isPrivate());
		try{
			new tomk79\LangBankView('ja', array());
			$this->fail('Error expected.');
		}catch( \Error $e ){
			$this->assertStringContainsString('private', $e->getMessage());
		}
	}

	/**
	 * 読み込み元のリストの中の空の要素を読み飛ばす
	 */
	public function testEmptySourcesInList(){
		$lb = new tomk79\LangBank(array($this->listCsv, null, '', array()));
		$this->assertSame('Hello', $lb->get('hello'));
		$lb = new tomk79\LangBank(array(null));
		$this->assertSame(array(), $lb->getLangList());
		$lb->load(array(null, __DIR__.'/testdata/regional.csv'));
		$this->assertSame('en', $lb->getDefaultLang());
	}

	/**
	 * 読み込み元のリストの中の CSV 配列に空の行があってもよい
	 */
	public function testNullRowsInSourceList(){
		$lb = new tomk79\LangBank(array(array(array('', 'en'), null, array('a', 'A')), $this->listCsv));
		$this->assertSame('A', $lb->get('a'));
		$this->assertSame('Hello', $lb->get('hello'));
		$lb = new tomk79\LangBank(array($this->listCsv, array(null, array('', 'en'), array('b', 'B'))));
		$this->assertSame('B', $lb->get('b'));
	}

	/**
	 * has() の exact オプション
	 */
	public function testHasExact(){
		$lb = new tomk79\LangBank(__DIR__.'/testdata/regional.csv', array('fallback' => array('en-GB' => 'en-US')));
		$lb->setLang('en-GB');
		$this->assertTrue($lb->has('color'));
		$this->assertFalse($lb->has('color', array('exact' => true)));
		$lb->setLang('ja_JP');
		$this->assertFalse($lb->has('hello', array('exact' => true)));
		$lb->setLang('JA');
		$this->assertTrue($lb->has('hello', array('exact' => true)));
		$lb->setLang('en-US');
		$this->assertFalse($lb->has('hello', array('exact' => true)));
		$this->assertTrue($lb->has('hello', array('exact' => null)));
		$this->assertTrue($lb->has('hello', array('exact' => false)));
		foreach( array(array('x' => 1), array('fallback' => false), array('exact' => 'yes')) as $options ){
			$this->assertLangBankError(function() use ($lb, $options){
				$lb->has('hello', $options);
			}, 'INVALID_OPTION');
		}
		try{
			$lb->has('hello', 'x');
			$this->fail('TypeError expected.');
		}catch( \TypeError $e ){
		}
	}

	/**
	 * エラーコードの定数
	 */
	public function testErrorCodeConstants(){
		foreach( array(
			'FILE_NOT_FOUND', 'FILE_READ_ERROR', 'INVALID_SOURCE', 'INVALID_CSV',
			'TEMPLATE_ERROR', 'INVALID_OPTION',
		) as $code ){
			$this->assertSame($code, constant('tomk79\LangBankException::'.$code));
		}
		// v2 で廃止したコード
		$this->assertFalse(defined('tomk79\LangBankException::CSV_PARSE_ERROR'));
		$this->assertFalse(defined('tomk79\LangBankException::CIRCULAR_REFERENCE'));
	}

	/**
	 * withLang() は言語を固定したビューを返す
	 */
	public function testWithLang(){
		$lb = new tomk79\LangBank(__DIR__.'/testdata/regional.csv');
		$ja = $lb->withLang('ja');
		$this->assertInstanceOf(tomk79\LangBankView::class, $ja);
		$this->assertSame('こんにちは', $ja->get('hello'));
		$this->assertSame('Hello', $lb->get('hello'));
		$lb->setLang('pt');
		$this->assertSame('こんにちは', $ja->get('hello'));
		$this->assertSame('ja', $ja->getLang());
		$this->assertSame('en', $ja->getDefaultLang());
		$this->assertTrue($ja->has('color'));
		$this->assertTrue($ja->has('color', array('exact' => true)));
		$this->assertSame('DEF', $ja->get('undefinedKey', 'DEF'));
		$this->assertFalse(method_exists($ja, 'setLang'));
		$this->assertFalse(method_exists($ja, 'load'));

		// 辞書は共有する
		$lb->load('"","ja"'."\n".'"new","新規"'."\n");
		$this->assertSame('新規', $ja->get('new'));

		// 言語なしはデフォルト言語
		$this->assertNull($lb->withLang(null)->getLang());
		$this->assertSame('Hello', $lb->withLang(null)->get('hello'));

		// ビューでもプレースホルダーを置き換える
		$lb = new tomk79\LangBank(__DIR__.'/testdata/placeholders.csv', array('bind' => array('name' => 'Global')));
		$this->assertSame('日本語 Global', $lb->withLang('ja')->get('ja_only'));
		$this->assertSame('日本語 太郎', $lb->withLang('ja')->get('ja_only', array('name' => '太郎')));
		$this->assertSame('[x]', $lb->withLang('ja')->get('nokey', array('name' => 'x'), '[{{ name }}]'));
		$this->assertLangBankError(function() use ($lb){
			$lb->withLang('ja')->get('nokey', null, '{% x %}');
		}, 'TEMPLATE_ERROR');

		// onMissing に言語を渡す
		$log = array();
		$lb = new tomk79\LangBank($this->listCsv, array(
			'onMissing' => function($key, $lang) use (&$log){ $log[] = $key.':'.$lang; },
		));
		$this->assertSame('nope', $lb->withLang('fr')->get('nope'));
		$this->assertSame(array('nope:fr'), $log);
	}

	/**
	 * 読み込み元は省略できる
	 */
	public function testSourceCanBeOmitted(){
		$lb = new tomk79\LangBank();
		$this->assertSame(array(), $lb->getLangList());
		$lb->load($this->listCsv);
		$this->assertSame('en', $lb->getLang());
		$this->assertSame('Hello', $lb->get('hello'));
	}

	/**
	 * resolveLang()
	 */
	public function testResolveLang(){
		$lb = new tomk79\LangBank(__DIR__.'/testdata/regional.csv', array('fallback' => array('zh-HK' => array('zh-TW', 'zh-Hant'))));
		$this->assertSame('ja', $lb->resolveLang('ja'));
		$this->assertSame('ja', $lb->resolveLang('JA_jp'));
		$this->assertSame('en-US', $lb->resolveLang('EN-us'));
		$this->assertSame('en', $lb->resolveLang('en-GB'));
		$this->assertSame('zh-Hant', $lb->resolveLang('zh-HK'));
		$this->assertSame('zh-Hant', $lb->resolveLang('zh-Hant-TW'));
		$this->assertNull($lb->resolveLang('xx'));
		$this->assertNull($lb->resolveLang(''));
		$this->assertNull($lb->resolveLang(null));

		// セルの内容は調べない (en-US の hello は空)
		$lb->setLang('en-US');
		$this->assertSame('en-US', $lb->resolveLang());
		$this->assertSame('Hello', $lb->get('hello'));

		// 省略すると現在の言語。setLang() の戻り値と対応する
		$lb->setLang('xx');
		$this->assertNull($lb->resolveLang());
		$lb->setLang(null);
		$this->assertNull($lb->resolveLang());
		$this->assertSame('pt', $lb->resolveLang('pt-BR'));

		$this->assertNull((new tomk79\LangBank())->resolveLang('en'));
	}

	/**
	 * resolveLang() はフォールバック先の言語からさらにフォールバックしない
	 */
	public function testResolveLangDoesNotFollowFallbackOfFallback(){
		$lb = new tomk79\LangBank(__DIR__.'/testdata/regional.csv', array('fallback' => array('zh-HK' => 'zh-Hant-TW', 'zh-MO' => 'zh-TW', 'zh-TW' => 'zh-Hant')));
		$this->assertNull($lb->resolveLang('zh-HK'));
		$this->assertNull($lb->resolveLang('zh-MO'));
		$this->assertSame('zh-Hant', $lb->resolveLang('zh-TW'));
	}

	/**
	 * ビューの resolveLang() と getLangList()
	 */
	public function testViewResolveLangAndLangList(){
		$lb = new tomk79\LangBank(__DIR__.'/testdata/regional.csv');
		$lb->setLang('ja');
		$view = $lb->withLang('en-GB');
		$this->assertSame('en', $view->resolveLang());
		$this->assertSame('ja', $view->resolveLang('JA'));
		$this->assertNull($view->resolveLang(null));
		$this->assertNull($lb->withLang(null)->resolveLang());
		$this->assertSame(array('en', 'en-US', 'ja', 'zh-Hant', 'pt'), $view->getLangList());

		// 呼び出した時点の辞書を反映する
		$lb->load('"","fr"'."\n".'"hello","Bonjour"');
		$this->assertSame(array('en', 'en-US', 'ja', 'zh-Hant', 'pt', 'fr'), $view->getLangList());
	}

	/**
	 * setLang() を呼んだ後の load() は現在の言語を変えない
	 */
	public function testLoadAfterSetLang(){
		$lb = new tomk79\LangBank();
		$lb->setLang(null);
		$lb->load(__DIR__.'/testdata/regional.csv');
		$this->assertNull($lb->getLang());
		$this->assertSame('en', $lb->getDefaultLang());

		$lb = new tomk79\LangBank();
		$lb->setLang('ja');
		$lb->load(__DIR__.'/testdata/regional.csv');
		$this->assertSame('ja', $lb->getLang());

		// 空の読み込み元では初期言語を決めない
		$lb = new tomk79\LangBank(array(null, '"","ja","en"'."\n".'"k","値","v"'));
		$this->assertSame('ja', $lb->getLang());
		$this->assertSame('ja', $lb->getDefaultLang());
	}

	/**
	 * load() はエラーなら辞書を変えない
	 */
	public function testLoadIsAtomic(){
		$lb = new tomk79\LangBank();
		foreach( array(
			array(__DIR__.'/testdata/regional.csv', __DIR__.'/testdata/notExists.csv'),
			array(__DIR__.'/testdata/regional.csv', array(array('key'), array('k', 'v'))),
			array(__DIR__.'/testdata/regional.csv', array(array('', 'en'), 'x')),
			array(__DIR__.'/testdata/regional.csv', array(array('', 'en'), array(array()))),
			array(__DIR__.'/testdata/regional.csv', '"","en"'."\n".'"k","{% broken %}"'),
			array(__DIR__.'/testdata/regional.csv', 1),
		) as $src ){
			try{
				$lb->load($src);
				$this->fail('LangBankException expected.');
			}catch( \tomk79\LangBankException $e ){
			}
			$this->assertSame(array(), $lb->getList());
			$this->assertSame(array(), $lb->getLangList());
			$this->assertNull($lb->getLang());
			$this->assertNull($lb->getDefaultLang());
			$this->assertNull($lb->resolveLang('en'));
		}

		// 失敗した読み込みは、次の読み込みに影響しない
		$lb->load('"","ja","en"'."\n".'"k","値","v"');
		$this->assertSame(array('ja', 'en'), $lb->getLangList());
		$this->assertSame('ja', $lb->getLang());
		$this->assertSame('ja', $lb->getDefaultLang());
		$this->assertSame(array('k' => array('ja' => '値', 'en' => 'v')), $lb->getList());

		// 読み込み済みの辞書も変えない
		$view = $lb->withLang('fr');
		$lb->setLang('en');
		try{
			$lb->load(array(__DIR__.'/testdata/regional.csv', array(array('key'), array('k', 'v'))));
			$this->fail('LangBankException expected.');
		}catch( \tomk79\LangBankException $e ){
		}
		$this->assertSame(array('ja', 'en'), $lb->getLangList());
		$this->assertSame(array('k' => array('ja' => '値', 'en' => 'v')), $lb->getList());
		$this->assertSame('en', $lb->getLang());
		$this->assertSame('ja', $lb->getDefaultLang());
		$this->assertNull($lb->resolveLang('fr'));
		$this->assertSame(array('ja', 'en'), $view->getLangList());
		$this->assertSame('値', $view->get('k'));

		// setLang(null) の後に失敗しても、次の読み込みで初期言語を設定しない
		$lb = new tomk79\LangBank();
		$lb->setLang(null);
		try{
			$lb->load(array(__DIR__.'/testdata/regional.csv', 1));
			$this->fail('LangBankException expected.');
		}catch( \tomk79\LangBankException $e ){
		}
		$lb->load(__DIR__.'/testdata/regional.csv');
		$this->assertNull($lb->getLang());
		$this->assertSame('en', $lb->getDefaultLang());
	}


	/**
	 * キーは文字列か整数に限る
	 */
	public function testKeyType(){
		$lb = new tomk79\LangBank('"","en"'."\n".'"123","num"'."\n");
		$view = $lb->withLang('en');
		foreach( array(
			fn() => $lb->get(null),
			fn() => $lb->has(null),
			fn() => $view->get(null),
			fn() => $view->has(null),
			fn() => $lb->get(array('a')),
		) as $fn ){
			try{
				$fn();
				$this->fail('TypeError expected.');
			}catch( \TypeError $e ){
			}
		}
		$this->assertSame('num', $lb->get(123));
		$this->assertTrue($lb->has(123));
		$this->assertSame('', $lb->get(''));
	}

	/**
	 * getList() は、すべてのキーにすべての言語を持たせる
	 */
	public function testGetListHasAllLangs(){
		$lb = new tomk79\LangBank('"","en"'."\n".'"a","A"'."\n");
		$lb->load('"","JA","ja"'."\n".'"b","B",""'."\n");
		$this->assertSame(array('en', 'JA'), $lb->getLangList());
		$this->assertSame(array(
			'a' => array('en' => 'A', 'JA' => ''),
			'b' => array('en' => '', 'JA' => 'B'),
		), $lb->getList());
	}

	/**
	 * ビューは、サブクラスでオーバーライドしたメソッドを経由しない
	 */
	public function testViewDoesNotUseOverriddenMethods(){
		$lb = new class(__DIR__.'/testdata/list.csv') extends tomk79\LangBank{
			public int $calls = 0;
			public function get( string|int $key, mixed $bindData = null, mixed $defaultValue = null ): string{
				$this->calls ++;
				return 'overridden';
			}
		};
		$this->assertSame('こんにちわ', $lb->withLang('ja')->get('hello'));
		$this->assertSame(0, $lb->calls);
	}

}
