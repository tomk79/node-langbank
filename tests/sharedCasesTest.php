<?php
/**
 * JS/PHP 共通のテストケース
 */
class sharedCasesTest extends PHPUnit\Framework\TestCase{

	public function setup() : void{
		mb_internal_encoding('UTF-8');
	}

	public function casesProvider(){
		$cases = json_decode(file_get_contents(__DIR__.'/testdata/cases.json'), true);
		$rtn = array();
		foreach( $cases as $case ){
			$rtn[$case['name']] = array($case);
		}
		return $rtn;
	}

	/**
	 * @dataProvider casesProvider
	 */
	public function testSharedCase($c){
		$source = array();
		foreach( (is_array($c['source']) ? $c['source'] : array($c['source'])) as $file ){
			$source[] = __DIR__.'/testdata/'.$file;
		}
		$lb = new tomk79\LangBank($source, $c['options'] ?? array());
		$lb->setLang($c['lang']);

		if( array_key_exists('bind', $c) && array_key_exists('default', $c) ){
			$result = $lb->get($c['key'], $c['bind'], $c['default']);
		}elseif( array_key_exists('bind', $c) ){
			$result = $lb->get($c['key'], $c['bind']);
		}elseif( array_key_exists('default', $c) ){
			$result = $lb->get($c['key'], $c['default']);
		}else{
			$result = $lb->get($c['key']);
		}
		$this->assertSame($c['expected'], $result);
	}

}
