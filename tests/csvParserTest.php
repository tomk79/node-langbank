<?php
/**
 * CSV のパーサー (NodeJS版と共通のテストデータ)
 *
 * testdata/csv_cases.json の rows は、PHP 8.4 の fgetcsv($fp, 0, ',', '"', '') が返した結果。
 * PHP版の parseCsv() は fgetcsv() を使わず、同じアルゴリズムを自前で実装している
 * (PHP 8.2 以前の fgetcsv() は、閉じていない引用符で終わる CSV の結果が違うため)。
 */
class csvParserTest extends PHPUnit\Framework\TestCase{

	public function casesProvider(){
		$cases = json_decode(file_get_contents(__DIR__.'/testdata/csv_cases.json'), true);
		$rtn = array();
		foreach( $cases as $case ){
			$rtn[$case['name']] = array($case);
		}
		return $rtn;
	}

	/**
	 * @dataProvider casesProvider
	 */
	public function testParseCsv($c){
		$parseCsv = new \ReflectionMethod(tomk79\LangBank::class, 'parseCsv');
		$parseCsv->setAccessible(true);
		$this->assertSame($c['rows'], $parseCsv->invoke(new tomk79\LangBank(), $c['csv']));
	}

	/**
	 * テストデータの期待値が、PHP 8.3 以降の fgetcsv() の結果と同じであること
	 *
	 * @dataProvider casesProvider
	 * @requires PHP >= 8.3
	 */
	public function testSameAsFgetcsv($c){
		$src = preg_replace('/^\xEF\xBB\xBF/', '', $c['csv']);
		if( strpos($src, "\n") === false ){
			$src = str_replace("\r", "\n", $src);
		}
		$fp = fopen('php://temp', 'r+');
		fwrite($fp, $src);
		rewind($fp);
		$rows = array();
		while( ($row = fgetcsv($fp, 0, ',', '"', '')) !== false ){
			$rows[] = $row;
		}
		fclose($fp);
		$this->assertSame($c['rows'], $rows);
	}

}
