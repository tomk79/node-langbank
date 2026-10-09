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

		$get = function() use ($lb, $c){
			if( array_key_exists('args', $c) ){
				return $lb->get($c['key'], ...$c['args']);
			}elseif( array_key_exists('bind', $c) && array_key_exists('default', $c) ){
				return $lb->get($c['key'], $c['bind'], $c['default']);
			}elseif( array_key_exists('bind', $c) ){
				return $lb->get($c['key'], $c['bind']);
			}elseif( array_key_exists('default', $c) ){
				return $lb->get($c['key'], $c['default']);
			}
			return $lb->get($c['key']);
		};

		if( array_key_exists('error', $c) ){
			try{
				$get();
			}catch( \tomk79\LangBankException $e ){
				$this->assertSame($c['error'], $e->getErrorCode());
				if( array_key_exists('message', $c) ){
					$this->assertStringContainsString($c['message'], $e->getMessage());
				}
				return;
			}
			$this->fail('LangBankException ('.$c['error'].') expected.');
		}
		$this->assertSame($c['expected'], $get());
	}

}
