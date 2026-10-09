<?php
/**
 * langbank.php
 */
namespace tomk79;

/**
 * langbank
 */
class LangBank{

	/** options.autoescape に指定できるエスケープの戦略 */
	private const AUTOESCAPE_STRATEGIES = array('html', 'js', 'css', 'url', 'html_attr');

	/** オプションの名前 */
	private const OPTION_NAMES = array('bind', 'autoescape', 'twig', 'onMissing', 'fallback');

	private mixed $pathCsv;
	private array $options = array();
	private array $langDb = array();
	private array $langList = array();
	private array $langMap = array(); // 正規化した言語コード => 列名
	private array $renderStack = array(); // 描画中の get() の {key, lang, bind, error}
	public ?string $defaultLang = null;
	public ?string $lang = null;

	/**
	 * constructor
	 *
	 * @param mixed $source 読み込み元 (ファイルパス, CSV文字列, パース済みのCSV配列, またはそれらの配列)
	 * @param array|null $options オプション
	 */
	public function __construct( mixed $source, ?array $options = null ){
		$this->pathCsv = $source;
		$this->options = $this->normalizeOptions($options ?? array());

		$this->load($source);
	}

	/**
	 * load additional words
	 *
	 * @param mixed $source 読み込み元
	 * @return static 自身
	 */
	public function load( mixed $source ): static{
		foreach( $this->toCsvArrays($source) as $csvAry ){
			$this->mergeCsv($csvAry);
		}
		return $this;
	}

	/**
	 * set Language
	 *
	 * @param string|null $lang 言語コード
	 * @return bool 辞書にその言語 (またはフォールバック先) があれば true
	 */
	public function setLang( ?string $lang ): bool{
		$this->lang = $lang;
		return count($this->resolveLangs($lang, true, false)) > 0;
	}

	/**
	 * get Language
	 *
	 * @return string|null 現在の言語
	 */
	public function getLang(): ?string{
		return $this->lang;
	}

	/**
	 * get default Language
	 *
	 * @return string|null デフォルト言語 (最初に読み込んだ CSV の、最初の言語の列)
	 */
	public function getDefaultLang(): ?string{
		return $this->defaultLang;
	}

	/**
	 * get language list
	 *
	 * @return array 辞書にある言語の列名
	 */
	public function getLangList(): array{
		return $this->langList;
	}

	/**
	 * get word by key
	 *
	 * 第 2 引数が文字列で、第 3 引数が null なら、第 2 引数をデフォルト値として扱う。
	 *
	 * @param string|int $key キー
	 * @param mixed $bindData バインドデータ (配列またはオブジェクト), またはデフォルト値
	 * @param mixed $defaultValue デフォルト(キーが未定義だった場合)の戻り値。文字列以外は指定なしとして扱う
	 * @return string 設定された言語に対応する文字列
	 */
	public function get( string|int $key, mixed $bindData = null, mixed $defaultValue = null ): string{
		return $this->getFor($this->lang, $key, $bindData, $defaultValue)->text;
	}

	/**
	 * has word
	 *
	 * @param string|int $key キー
	 * @param array|null $options オプション (`fallback`: false にすると、現在の言語の列だけを探す)
	 * @return bool 現在の言語 (フォールバックを含む) で訳文が見つかれば true
	 */
	public function has( string|int $key, ?array $options = null ): bool{
		return $this->hasFor($this->lang, $key, $options);
	}

	/**
	 * 言語を固定したビューを返す
	 *
	 * @param string|null $lang 言語コード
	 * @return LangBankView 辞書を共有する、読み取り専用のビュー
	 */
	public function withLang( ?string $lang ): LangBankView{
		return new LangBankView(
			$lang,
			function( $key, $bindData, $defaultValue ) use ( $lang ){
				return $this->getFor($lang, $key, $bindData, $defaultValue)->text;
			},
			function( $key, $options ) use ( $lang ){
				return $this->hasFor($lang, $key, $options);
			},
			function(){
				return $this->defaultLang;
			}
		);
	}

	/**
	 * get word list
	 *
	 * @return array 辞書 (`[key => [lang => word]]`)
	 */
	public function getList(): array{
		return $this->langDb;
	}


	/**
	 * オプションを検証し、正規化する
	 */
	private function normalizeOptions( array $options ): array{
		$rtn = array();
		foreach( $options as $name => $value ){
			if( !in_array($name, self::OPTION_NAMES, true) ){
				throw new LangBankException('INVALID_OPTION', 'Unknown option: '.$name);
			}
			if( is_null($value) ){
				continue;
			}
			switch( $name ){
				case 'bind':
					if( !is_array($value) && !is_object($value) ){
						throw new LangBankException('INVALID_OPTION', 'Option "bind" must be an array or an object.');
					}
					break;
				case 'autoescape':
					if( $value === true ){
						$value = 'html';
					}elseif( $value !== false && !in_array($value, self::AUTOESCAPE_STRATEGIES, true) ){
						throw new LangBankException('INVALID_OPTION', 'Option "autoescape" must be false, true, or one of: '.implode(', ', self::AUTOESCAPE_STRATEGIES).'.');
					}
					break;
				case 'twig':
					if( !is_bool($value) ){
						throw new LangBankException('INVALID_OPTION', 'Option "twig" must be a boolean.');
					}
					break;
				case 'onMissing':
					if( !is_callable($value) ){
						throw new LangBankException('INVALID_OPTION', 'Option "onMissing" must be a callable.');
					}
					break;
				case 'fallback':
					if( !is_array($value) ){
						throw new LangBankException('INVALID_OPTION', 'Option "fallback" must be an array.');
					}
					$fallback = array();
					foreach( $value as $lang => $langs ){
						$langs = is_string($langs) ? array($langs) : $langs;
						if( !is_array($langs) || count(array_filter($langs, 'is_string')) !== count($langs) ){
							throw new LangBankException('INVALID_OPTION', 'Option "fallback" must map a language to a string or an array of strings: '.$lang);
						}
						$fallback[$lang] = array_values($langs);
					}
					$value = $fallback;
					break;
			}
			$rtn[$name] = $value;
		}
		return $rtn;
	}

	/**
	 * has() のオプションを検証し、フォールバックするかどうかを返す
	 */
	private function useFallbackForHas( ?array $options ): bool{
		$fallback = true;
		foreach( $options ?? array() as $name => $value ){
			if( $name !== 'fallback' ){
				throw new LangBankException('INVALID_OPTION', 'Unknown option of has(): '.$name);
			}
			if( is_null($value) ){
				continue;
			}
			if( !is_bool($value) ){
				throw new LangBankException('INVALID_OPTION', 'Option "fallback" of has() must be a boolean.');
			}
			$fallback = $value;
		}
		return $fallback;
	}

	/**
	 * 空の読み込み元か (読み込み元のリストの中では読み飛ばす)
	 */
	private function isEmptySource( $value ){
		return is_null($value) || $value === '' || $value === array();
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
				if( !$this->isEmptySource($item) && !is_string($item) && !$this->is2dArray($item) ){
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
	 *
	 * $useFallback が false なら、その言語の列だけを探す。
	 */
	private function resolveLangs( $lang, $useFallback, $includeDefault ){
		$candidates = array();
		$add = function($l) use (&$candidates){
			$normalized = $this->normalizeLang($l);
			if( $normalized !== '' && !in_array($normalized, $candidates, true) ){
				$candidates[] = $normalized;
			}
		};

		if( ''.$lang !== '' ){
			$add($lang);
		}

		if( $useFallback && ''.$lang !== '' ){
			foreach( $this->options['fallback'] ?? array() as $fallbackKey => $langs ){
				if( $this->normalizeLang($fallbackKey) !== $this->normalizeLang($lang) ){
					continue;
				}
				foreach( $langs as $l ){
					$add($l);
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
	 * 指定した言語で訳文を探す (見つからなければ null)
	 */
	private function findValue( $key, $lang, $useFallback ){
		if( !array_key_exists($key, $this->langDb) ){
			return null;
		}
		foreach( $this->resolveLangs($lang, $useFallback, $useFallback) as $column ){
			$value = $this->langDb[$key][$column] ?? null;
			if( is_string($value) && $value !== '' ){
				return $value;
			}
		}
		return null;
	}

	/**
	 * 指定した言語で get() する
	 *
	 * 戻り値は {text, trusted}。trusted は、訳文かデフォルト値から作った文字列なら true。
	 * (キーそのものや onMissing の戻り値は、テンプレートの中で安全な文字列として扱わない)
	 */
	private function getFor( ?string $lang, $key, $bindData, $defaultValue ): object{
		if( is_string($bindData) && is_null($defaultValue) ){
			// 第 2 引数の文字列はデフォルト値
			$defaultValue = $bindData;
			$bindData = null;
		}
		try{
			return $this->getWord(''.$key, $bindData, $defaultValue, $lang);
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
	 * 指定した言語で has() する
	 */
	private function hasFor( ?string $lang, $key, ?array $options ): bool{
		return !is_null($this->findValue(''.$key, $lang, $this->useFallbackForHas($options)));
	}

	/**
	 * get() の本体
	 */
	private function getWord( $key, $bindData, $defaultValue, $lang ){
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

		$value = $this->findValue($key, $lang, true);
		if( !is_null($value) ){
			return (object) array('text' => $this->render($value, $bindData, $key, $lang), 'trusted' => true);
		}
		if( is_string($defaultValue) ){
			return (object) array('text' => $this->render($defaultValue, $bindData, $key, $lang), 'trusted' => true);
		}
		if( isset($this->options['onMissing']) ){
			$missing = call_user_func($this->options['onMissing'], $key, $lang);
			if( is_string($missing) ){
				return (object) array('text' => $missing, 'trusted' => false);
			}
		}
		return (object) array('text' => $key, 'trusted' => false);
	}

	/**
	 * Twig テンプレートを評価する
	 */
	private function render( $template, $bindData, $key, $lang ){
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
		$data['_ENV'] = $this->createTemplateEnv($lang);

		$autoescape = $this->options['autoescape'] ?? false;

		$frame = (object) array('key' => $key, 'lang' => $lang, 'bind' => $bind, 'error' => null);
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
			throw new LangBankException('TEMPLATE_ERROR', 'Failed to render template of key "'.$key.'" (lang: '.$lang.'): '.$e->getMessage(), $e);
		}finally{
			array_pop($this->renderStack);
		}
	}

	/**
	 * テンプレートに _ENV として渡す、読み取り専用のオブジェクト
	 *
	 * Twig は `_ENV.lang` を getLang() で解決する。
	 * autoescape が有効なら、訳文やデフォルト値から作った get() の結果を安全な文字列 (\Twig\Markup) で返し、
	 * 二重にエスケープされないようにする。キーそのものや onMissing の戻り値は、外側のテンプレートでエスケープさせる。
	 * (無名クラスは serialize() できないため、プロパティには保存しない)
	 */
	private function createTemplateEnv( $lang ){
		$getFn = function( $key, $bindData, $defaultValue ) use ( $lang ){
			return $this->getFor($lang, $key, $bindData, $defaultValue);
		};
		return new class($this->withLang($lang), $getFn, ($this->options['autoescape'] ?? false) !== false){
			private $view;
			private $getFn;
			private $markup;
			public function __construct( $view, $getFn, $markup ){
				$this->view = $view;
				$this->getFn = $getFn;
				$this->markup = $markup;
			}
			public function get( $key, $bindData = null, $defaultValue = null ){
				$result = ($this->getFn)($key, $bindData, $defaultValue);
				return ($this->markup && $result->trusted) ? new \Twig\Markup($result->text, 'UTF-8') : $result->text;
			}
			public function has( $key, $options = null ){
				return $this->view->has($key, $options);
			}
			public function getLang(){
				return $this->view->getLang();
			}
			public function getDefaultLang(){
				return $this->view->getDefaultLang();
			}
		};
	}

}
