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
	private bool $langIsSet = false; // setLang() が呼ばれたか
	public ?string $defaultLang = null;
	public ?string $lang = null;

	/**
	 * constructor
	 *
	 * @param mixed $source 読み込み元 (ファイルパス, CSV文字列, パース済みのCSV配列, またはそれらの配列)。省略すると空の辞書
	 * @param array|null $options オプション
	 */
	public function __construct( mixed $source = null, ?array $options = null ){
		$this->pathCsv = $source;
		$this->options = $this->normalizeOptions($options ?? array());

		$this->load($source);
	}

	/**
	 * load additional words
	 *
	 * エラーの場合は辞書を変えない。
	 *
	 * @param mixed $source 読み込み元
	 * @return static 自身
	 */
	public function load( mixed $source ): static{
		// すべて検証してからマージする
		$preparedList = array();
		foreach( $this->toCsvArrays($source) as $csvAry ){
			$preparedList[] = $this->prepareCsv($csvAry);
		}
		foreach( $preparedList as $prepared ){
			if( !is_null($prepared) ){
				$this->mergeCsv($prepared);
			}
		}
		return $this;
	}

	/**
	 * set Language
	 *
	 * @param string|null $lang 言語コード
	 * @return bool 辞書にその言語 (またはフォールバック先) があれば true。resolveLang($lang) !== null と同じ
	 */
	public function setLang( ?string $lang ): bool{
		$this->lang = $lang;
		$this->langIsSet = true;
		return !is_null($this->resolveLangFor($lang));
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
	 * 言語を辞書の列名に解決する
	 *
	 * 指定した言語, options.fallback, サブタグを削った言語の順で、辞書にある最初の列名を返す。
	 * セルの内容は調べず、デフォルト言語へのフォールバックも含めない。
	 *
	 * @param string|null $lang 言語コード。省略すると現在の言語。null は言語の指定なしとして null を返す
	 * @return string|null 辞書の列名。見つからなければ null
	 */
	public function resolveLang( ?string $lang = null ): ?string{
		return $this->resolveLangFor(func_num_args() ? $lang : $this->lang);
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
	 * @param mixed $defaultValue デフォルト値 (訳文が見つからなかった場合の戻り値)。文字列以外は指定なしとして扱う
	 * @return string 設定された言語に対応する文字列
	 */
	public function get( string|int $key, mixed $bindData = null, mixed $defaultValue = null ): string{
		return $this->getFor($this->lang, $key, $bindData, $defaultValue)->text;
	}

	/**
	 * has word
	 *
	 * @param string|int $key キー
	 * @param array|null $options オプション (`exact`: true にすると、現在の言語の列だけを探す)
	 * @return bool 現在の言語 (フォールバックを含む) で訳文が見つかれば true
	 */
	public function has( string|int $key, ?array $options = null ): bool{
		return $this->hasFor($this->lang, $key, $options);
	}

	/**
	 * 言語を固定したビューを返す
	 *
	 * @param string|null $lang 言語コード。null ならデフォルト言語だけを探すビュー
	 * @return LangBankView 辞書を共有する、読み取り専用のビュー
	 */
	public function withLang( ?string $lang ): LangBankView{
		return $this->createView($lang);
	}

	/**
	 * get word list
	 *
	 * @return array 辞書 (`[key => [lang => word]]`)。すべてのキーが getLangList() のすべての言語を持つ (訳文がなければ '')
	 */
	public function getList(): array{
		// すべてのキーに、辞書にあるすべての言語を持たせる (セルがなければ '')
		$rtn = array();
		foreach( $this->langDb as $key => $entry ){
			$rtn[$key] = array();
			foreach( $this->langList as $lang ){
				$rtn[$key][$lang] = $entry[$lang] ?? '';
			}
		}
		return $rtn;
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
		$exact = false;
		foreach( $options ?? array() as $name => $value ){
			if( $name !== 'exact' ){
				throw new LangBankException('INVALID_OPTION', 'Unknown option of has(): '.$name);
			}
			if( is_null($value) ){
				continue;
			}
			if( !is_bool($value) ){
				throw new LangBankException('INVALID_OPTION', 'Option "exact" of has() must be a boolean.');
			}
			$exact = $value;
		}
		return !$exact;
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
	 * パース済みCSV配列に見えるか (配列の行を 1 つ以上含み、それ以外の行は null)
	 */
	private function is2dArray( $value ){
		if( !is_array($value) ){
			return false;
		}
		$hasRow = false;
		foreach( $value as $row ){
			if( is_array($row) ){
				$hasRow = true;
			}elseif( !is_null($row) ){
				return false;
			}
		}
		return $hasRow;
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
	 * パース済みのCSV配列を検証する
	 *
	 * 辞書は変更しない。空のCSVなら null、そうでなければ {rows, header} を返す。
	 * header は、列のインデックス => 言語名 (言語の列だけ)。
	 */
	private function prepareCsv( $csvAry ){
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
			return null;
		}

		$header = array();
		foreach( $rows[0] as $idx => $cell ){
			$lang = ''.$cell;
			if( $idx > 0 && $lang !== '' ){
				$header[$idx] = $lang;
			}
		}
		if( !count($header) ){
			throw new LangBankException('INVALID_CSV', 'CSV header has no language columns.');
		}
		return (object) array('rows' => $rows, 'header' => $header);
	}

	/**
	 * prepareCsv() で検証したCSVを辞書にマージする
	 */
	private function mergeCsv( object $prepared ){
		$rows = $prepared->rows;

		// 大小文字や _/- だけが違う言語名は、最初に現れた表記の列にまとめる
		$langIdx = array();
		foreach( $prepared->header as $idx => $lang ){
			$normalized = $this->normalizeLang($lang);
			if( !array_key_exists($normalized, $this->langMap) ){
				$this->langMap[$normalized] = $lang;
				$this->langList[] = $lang;
			}
			$langIdx[$idx] = $this->langMap[$normalized];
		}

		if( is_null($this->defaultLang) ){
			// 最初に読み込んだCSVの最初の列を、デフォルト言語にする
			// setLang() が呼ばれていなければ、初期言語にもする
			$this->defaultLang = reset($langIdx);
			if( !$this->langIsSet ){
				$this->lang = $this->defaultLang;
			}
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
	 * 言語を辞書の列名に解決する (デフォルト言語へのフォールバックは含めない。見つからなければ null)
	 */
	private function resolveLangFor( ?string $lang ): ?string{
		$langs = $this->resolveLangs($lang, true, false);
		return count($langs) ? $langs[0] : null;
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
	 * 言語を固定したビューを作る
	 *
	 * withLang() と _ENV で使う。(サブクラスでオーバーライドされた withLang() を経由しない)
	 */
	private function createView( ?string $lang ): LangBankView{
		return new LangBankView($lang, array(
			'get' => function( $key, $bindData, $defaultValue ) use ( $lang ){
				return $this->getFor($lang, $key, $bindData, $defaultValue)->text;
			},
			'has' => function( $key, $options ) use ( $lang ){
				return $this->hasFor($lang, $key, $options);
			},
			'resolveLang' => function( $lang ){
				return $this->resolveLangFor($lang);
			},
			'getDefaultLang' => function(){
				return $this->defaultLang;
			},
			'getLangList' => function(){
				return $this->langList;
			},
		));
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
		return new class($this->createView($lang), $getFn, ($this->options['autoescape'] ?? false) !== false){
			private $view;
			private $getFn;
			private $markup;
			public function __construct( $view, $getFn, $markup ){
				$this->view = $view;
				$this->getFn = $getFn;
				$this->markup = $markup;
			}
			public function get( string|int $key, mixed $bindData = null, mixed $defaultValue = null ){
				$result = ($this->getFn)($key, $bindData, $defaultValue);
				return ($this->markup && $result->trusted) ? new \Twig\Markup($result->text, 'UTF-8') : $result->text;
			}
			public function has( string|int $key, ?array $options = null ){
				return $this->view->has($key, $options);
			}
			public function resolveLang( ...$args ){
				// 引数の省略と null を区別するため、引数をそのまま渡す
				return $this->view->resolveLang(...$args);
			}
			public function getLang(){
				return $this->view->getLang();
			}
			public function getDefaultLang(){
				return $this->view->getDefaultLang();
			}
			public function getLangList(){
				return $this->view->getLangList();
			}
		};
	}

}
