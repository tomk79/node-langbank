<?php
/**
 * langbank.php
 */
namespace tomk79;

/**
 * langbank
 */
class LangBank{

	private $pathCsv;
	private $options = array();
	private $langDb = array();
	private $langList = array();
	private $langMap = array(); // 正規化した言語コード => 列名
	private $renderStack = array(); // 描画中の get() の {key, bind, error}
	public $defaultLang;
	public $lang;

	/**
	 * constructor
	 *
	 * @param mixed $csv 読み込み元 (ファイルパス, CSV文字列, パース済みのCSV配列, またはそれらの配列)
	 * @param array $options オプション
	 */
	public function __construct( $csv, $options = array() ){
		$this->pathCsv = $csv;
		$this->options = is_array($options) ? $options : array();

		$this->load($csv);
	}

	/**
	 * load additional words
	 *
	 * @param mixed $csv 読み込み元
	 * @return LangBank 自身
	 */
	public function load( $csv ){
		foreach( $this->toCsvArrays($csv) as $csvAry ){
			$this->mergeCsv($csvAry);
		}
		return $this;
	}

	/**
	 * set Language
	 *
	 * @param string $lang 言語コード
	 * @return boolean 辞書にその言語 (またはフォールバック先) があれば true
	 */
	public function setLang($lang){
		$this->lang = $lang;
		return count($this->resolveLangs($lang, false)) > 0;
	}

	/**
	 * get Language
	 *
	 * @return string|null 現在の言語
	 */
	public function getLang(){
		return $this->lang;
	}

	/**
	 * get default Language
	 *
	 * @return string|null デフォルト言語 (最初に読み込んだ CSV の、最初の言語の列)
	 */
	public function getDefaultLang(){
		return $this->defaultLang;
	}

	/**
	 * get language list
	 *
	 * @return array 辞書にある言語の列名
	 */
	public function getLangList(){
		return $this->langList;
	}

	/**
	 * get word by key
	 *
	 * @param string $key キー
	 * @param array|object|null $bindData バインドデータ(省略可)
	 * @param string $defaultValue デフォルト(キーが未定義だった場合)の戻り値
	 * @return string 設定された言語に対応する文字列
	 */
	public function get($key){
		$bindData = null;
		$defaultValue = null;

		$args = func_get_args();
		if( count($args) == 2 ){
			if( is_string($args[1]) ){
				$defaultValue = $args[1];
			}else{
				$bindData = $args[1];
			}
		}elseif( count($args) >= 3 ){
			$bindData = $args[1];
			$defaultValue = $args[2];
		}

		$key = ''.$key;
		try{
			return $this->getWord($key, $bindData, $defaultValue);
		}catch( LangBankException $e ){
			$parent = end($this->renderStack);
			if( $parent && !$parent->error ){
				// テンプレートの中から呼ばれた場合は、外側の get() にエラーを伝える
				$parent->error = $e;
			}
			throw $e;
		}
	}

	/**
	 * has word
	 *
	 * @param string $key キー
	 * @return boolean 現在の言語 (フォールバックを含む) で訳文が見つかれば true
	 */
	public function has($key){
		return !is_null($this->findValue(''.$key));
	}

	/**
	 * get word list
	 */
	public function getList(){
		return $this->langDb;
	}


	/**
	 * 読み込み元を、パース済みCSV配列のリストにする
	 */
	private function toCsvArrays( $csv ){
		if( is_null($csv) || $csv === '' ){
			return array();
		}
		if( is_string($csv) ){
			return array($this->readCsvString($csv));
		}
		if( is_array($csv) ){
			$isSourceList = count($csv) > 0;
			foreach( $csv as $item ){
				if( !is_string($item) && !$this->is2dArray($item) ){
					$isSourceList = false;
					break;
				}
			}
			if( !$isSourceList ){
				// パース済みのCSV配列
				return array($csv);
			}
			$rtn = array();
			foreach( $csv as $item ){
				foreach( $this->toCsvArrays($item) as $csvAry ){
					$rtn[] = $csvAry;
				}
			}
			return $rtn;
		}
		throw new LangBankException('INVALID_SOURCE', 'Unsupported source type: '.gettype($csv));
	}

	/**
	 * 空でない2次元配列か
	 */
	private function is2dArray( $value ){
		if( !is_array($value) || !count($value) ){
			return false;
		}
		foreach( $value as $row ){
			if( !is_array($row) ){
				return false;
			}
		}
		return true;
	}

	/**
	 * 文字列を、CSV文字列またはファイルパスとして読み込む
	 */
	private function readCsvString( $csv ){
		if( preg_match('/[\r\n]/', $csv) ){
			// 改行を含む文字列は CSV として扱う
			return $this->parseCsv($csv);
		}

		// 改行を含まない文字列はファイルパスとして扱う
		if( !is_file($csv) ){
			throw new LangBankException('FILE_NOT_FOUND', 'File not found: '.$csv);
		}
		$content = @file_get_contents($csv);
		if( !is_string($content) ){
			throw new LangBankException('FILE_READ_ERROR', 'Failed to read file: '.$csv);
		}

		// UTF-8 以外 (Shift_JIS, EUC-JP) で保存されたファイルは、内部エンコーディングに変換する
		$content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
		$encoding = mb_detect_encoding($content, array('UTF-8', 'SJIS-win', 'eucJP-win'), true);
		if( $encoding !== false && $encoding !== mb_internal_encoding() ){
			$content = mb_convert_encoding($content, mb_internal_encoding(), $encoding);
		}
		return $this->parseCsv($content);
	}

	/**
	 * CSV文字列をパースする
	 */
	private function parseCsv( $src ){
		$src = preg_replace('/^\xEF\xBB\xBF/', '', $src);
		if( strpos($src, "\n") === false ){
			// CR だけで改行された CSV
			$src = str_replace("\r", "\n", $src);
		}
		$fp = fopen('php://temp', 'r+');
		fwrite($fp, $src);
		rewind($fp);
		$rtn = array();
		// バックスラッシュはエスケープ文字として扱わない (RFC 4180)
		while( ($row = fgetcsv($fp, 0, ',', '"', '')) !== false ){
			$rtn[] = $row;
		}
		fclose($fp);
		return $rtn;
	}

	/**
	 * パース済みのCSV配列を辞書にマージする
	 */
	private function mergeCsv( $csvAry ){
		$rows = array();
		foreach( $csvAry as $row ){
			if( is_null($row) ){
				continue;
			}
			if( !is_array($row) ){
				throw new LangBankException('INVALID_SOURCE', 'Each row of CSV array must be an array.');
			}
			foreach( $row as $cell ){
				if( !is_null($cell) && !is_scalar($cell) ){
					throw new LangBankException('INVALID_SOURCE', 'Each cell of CSV array must be a scalar value.');
				}
			}
			foreach( $row as $cell ){
				if( ''.$cell !== '' ){
					$rows[] = array_values($row);
					break;
				}
			}
		}
		if( !count($rows) ){
			return;
		}

		// 大小文字や _/- だけが違う言語名は、最初に現れた表記の列にまとめる
		$langIdx = array();
		foreach( $rows[0] as $idx => $cell ){
			$lang = ''.$cell;
			if( $idx == 0 || $lang === '' ){
				continue;
			}
			$normalized = $this->normalizeLang($lang);
			if( !array_key_exists($normalized, $this->langMap) ){
				$this->langMap[$normalized] = $lang;
				$this->langList[] = $lang;
			}
			$langIdx[$idx] = $this->langMap[$normalized];
		}
		if( !count($langIdx) ){
			throw new LangBankException('INVALID_CSV', 'CSV header has no language columns.');
		}

		$firstLang = reset($langIdx);
		if( is_null($this->defaultLang) ){
			$this->defaultLang = $firstLang;
		}
		if( is_null($this->lang) ){
			$this->lang = $firstLang;
		}

		foreach( array_slice($rows, 1) as $row ){
			$key = ''.$row[0];
			if( $key === '' ){
				continue;
			}
			if( !array_key_exists($key, $this->langDb) ){
				$this->langDb[$key] = array();
			}
			foreach( $langIdx as $idx => $lang ){
				$value = ''.($row[$idx] ?? '');
				if( $value !== '' || !array_key_exists($lang, $this->langDb[$key]) ){
					// 空でないセルだけで後勝ちする
					$this->langDb[$key][$lang] = $value;
				}
			}
		}
	}

	/**
	 * 言語コードを照合用に正規化する
	 */
	private function normalizeLang( $lang ){
		return str_replace('_', '-', strtolower(''.$lang));
	}

	/**
	 * 言語の候補を、辞書の列名のリストにする
	 */
	private function resolveLangs( $lang, $includeDefault ){
		$candidates = array();
		$add = function($l) use (&$candidates){
			$normalized = $this->normalizeLang($l);
			if( $normalized !== '' && !in_array($normalized, $candidates, true) ){
				$candidates[] = $normalized;
			}
		};

		if( ''.$lang !== '' ){
			$add($lang);

			$fallback = $this->options['fallback'] ?? null;
			if( is_array($fallback) ){
				foreach( $fallback as $fallbackKey => $langs ){
					if( $this->normalizeLang($fallbackKey) !== $this->normalizeLang($lang) ){
						continue;
					}
					foreach( (is_array($langs) ? $langs : array($langs)) as $l ){
						$add($l);
					}
				}
			}

			$parts = explode('-', $this->normalizeLang($lang));
			while( count($parts) > 1 ){
				array_pop($parts);
				$add(implode('-', $parts));
			}
		}

		$rtn = array();
		foreach( $candidates as $normalized ){
			if( array_key_exists($normalized, $this->langMap) && !in_array($this->langMap[$normalized], $rtn, true) ){
				$rtn[] = $this->langMap[$normalized];
			}
		}
		if( $includeDefault && !is_null($this->defaultLang) && !in_array($this->defaultLang, $rtn, true) ){
			$rtn[] = $this->defaultLang;
		}
		return $rtn;
	}

	/**
	 * 現在の言語で訳文を探す (見つからなければ null)
	 */
	private function findValue( $key ){
		if( !array_key_exists($key, $this->langDb) ){
			return null;
		}
		foreach( $this->resolveLangs($this->lang, true) as $lang ){
			$value = $this->langDb[$key][$lang] ?? null;
			if( is_string($value) && $value !== '' ){
				return $value;
			}
		}
		return null;
	}

	/**
	 * get() の本体
	 */
	private function getWord( $key, $bindData, $defaultValue ){
		$path = array();
		foreach( $this->renderStack as $frame ){
			$path[] = $frame->key;
		}
		$pos = array_search($key, $path, true);
		if( $pos !== false ){
			$path = array_slice($path, $pos);
			$path[] = $key;
			throw new LangBankException('CIRCULAR_REFERENCE', 'Circular reference: '.implode(' -> ', $path));
		}

		$value = $this->findValue($key);
		if( !is_null($value) ){
			return $this->render($value, $bindData, $key);
		}
		if( is_string($defaultValue) ){
			return $this->render($defaultValue, $bindData, $key);
		}
		$onMissing = $this->options['onMissing'] ?? null;
		if( is_callable($onMissing) ){
			$missing = call_user_func($onMissing, $key, $this->lang);
			if( is_string($missing) ){
				return $missing;
			}
		}
		return $key;
	}

	/**
	 * Twig テンプレートを評価する
	 */
	private function render( $template, $bindData, $key ){
		if( ($this->options['twig'] ?? true) === false || !preg_match('/\{[\{\%\#]/', $template) ){
			return $template;
		}

		// バインドデータは options.bind < 外側の get() のデータ < この get() のデータ の順で上書きする
		$parent = end($this->renderStack);
		$bind = $parent ? $parent->bind : (array) ($this->options['bind'] ?? array());
		if( is_array($bindData) || is_object($bindData) ){
			foreach( $bindData as $bindDataKey=>$bindDataValue ){
				$bind[$bindDataKey] = $bindDataValue;
			}
		}
		$data = $bind;
		$data['_ENV'] = $this->createTemplateEnv();

		$autoescape = $this->options['autoescape'] ?? false;
		if( $autoescape === true ){
			$autoescape = 'html';
		}

		$frame = (object) array('key' => $key, 'bind' => $bind, 'error' => null);
		$this->renderStack[] = $frame;
		try{
			// Twig はコンパイル済みのクラスを テンプレート名とソース で識別するため、
			// autoescape の設定ごとにテンプレート名を分ける
			$templateName = 'langbank.'.(is_string($autoescape) ? $autoescape : 'none');
			$loader = new \Twig\Loader\ArrayLoader(array(
				$templateName => $template,
			));
			$twig = new \Twig\Environment($loader, array(
				'autoescape' => $autoescape,
			));
			return $twig->render($templateName, $data);
		}catch( \Throwable $e ){
			if( $frame->error ){
				// 入れ子の get() で起きたエラーは、包み直さずにそのまま投げる
				throw $frame->error;
			}
			throw new LangBankException('TEMPLATE_ERROR', 'Failed to render template of key "'.$key.'" (lang: '.$this->lang.'): '.$e->getMessage(), $e);
		}finally{
			array_pop($this->renderStack);
		}
	}

	/**
	 * テンプレートに _ENV として渡す、読み取り専用のオブジェクト
	 *
	 * Twig は `_ENV.lang` を getLang() で解決する。
	 * (無名クラスは serialize() できないため、プロパティには保存しない)
	 */
	private function createTemplateEnv(){
		return new class($this){
			private $lb;
			public function __construct( $lb ){
				$this->lb = $lb;
			}
			public function get( $key ){
				return call_user_func_array(array($this->lb, 'get'), func_get_args());
			}
			public function has( $key ){
				return $this->lb->has($key);
			}
			public function getLang(){
				return $this->lb->getLang();
			}
			public function getDefaultLang(){
				return $this->lb->getDefaultLang();
			}
		};
	}

}
