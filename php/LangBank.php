<?php
/**
 * langbank.php
 */
namespace tomk79;

/**
 * langbank
 */
class LangBank{

	private $fs;
	private $pathCsv;
	private $options = array();
	private $langDb = array();
	public $defaultLang;
	public $lang;

	/**
	 * constructor
	 */
	public function __construct( $csv, $options = array() ){
		$this->pathCsv = $csv;
		$this->options = $options;
		$this->fs = new \tomk79\filesystem();

		$this->langDb = array();
		if( is_string($this->pathCsv) && strlen($this->pathCsv) && is_file($this->pathCsv) ){
			$csvAry = $this->fs->read_csv($this->pathCsv);
		}else{
			// PHP版は、ファイルからの読み込みのみに対応
			return false;
		}

		$langIdx = array();

		foreach( $csvAry as $i1=>$row1 ){
			if($i1 == 0){
				foreach( $csvAry[$i1] as $i2=>$row2 ){
					if($i2 == 0){
						continue;
					}
					if($i2 == 1){
						$this->defaultLang = $csvAry[$i1][$i2];
						$this->lang = $csvAry[$i1][$i2];
					}
					$langIdx[$i2] = $csvAry[$i1][$i2];
				}
			}else{
				$this->langDb[$csvAry[$i1][0]] = array();
				foreach( $csvAry[$i1] as $i2=>$row2 ){
					if($i2 == 0){continue;}
					$this->langDb[$csvAry[$i1][0]][$langIdx[$i2]] = $csvAry[$i1][$i2];
				}
			}
		}
	}

	/**
	 * set Language
	 */
	public function setLang($lang){
		$this->lang = $lang;
		return true;
	}

	/**
	 * get Language
	 */
	public function getLang(){
		return $this->lang;
	}

	/**
	 * get word by key
	 */
	public function get($key, $defaultValue = '---'){
		if( !strlen(''.$defaultValue) ){
			$defaultValue = '---';
		}
		if( !array_key_exists($key, $this->langDb) || !$this->langDb[$key] ){
			return $defaultValue;
		}
		$lang = $this->lang;
		if( !isset($this->langDb[$key][$lang]) || !strlen(''.$this->langDb[$key][$lang]) ){
			$lang = $this->defaultLang;
		}
		if( !isset($this->langDb[$key][$lang]) || !strlen(''.$this->langDb[$key][$lang]) ){
			return $defaultValue;
		}
		$rtn = $this->langDb[$key][$lang];
		$data = (@$this->options['bind'] ? $this->options['bind'] : array());
		$data['_ENV'] = $this;


		// PHP版は、ejs ではなく twig に対応
		if( class_exists('\\Twig_Loader_Array') ){
			// Twig ^1.35.3
			$loader = new \Twig_Loader_Array(array(
				'index' => $rtn,
			));
			$twig = new \Twig_Environment($loader);
			$rtn = $twig->render('index', $data);

		}elseif( class_exists('\\Twig\\Loader\\ArrayLoader') ){
			// Twig ^3.0.0
			$loader = new \Twig\Loader\ArrayLoader([
				'index' => $rtn,
			]);
			$twig = new \Twig\Environment($loader);
			$rtn = $twig->render('index', $data);

		}

		return $rtn;
	}

	/**
	 * get word list
	 */
	public function getList(){
		return $this->langDb;
	}

}
