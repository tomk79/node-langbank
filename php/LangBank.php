<?php
/**
 * langbank.php
 */
namespace tomk79;

/**
 * langbank
 */
class LangBank{

	/** オプションの名前 */
	private const OPTION_NAMES = array('bind', 'template', 'onMissing', 'fallback');

	/**
	 * プレースホルダー ({{ name }}) か、予約した構文 ({{, {%, {#) にマッチする正規表現
	 *
	 * 予約した構文にマッチしたときは、1 番目のグループがない。
	 */
	private const PLACEHOLDER_PATTERN = '/\{\{[ \t\r\n]*([A-Za-z_][A-Za-z0-9_]*)[ \t\r\n]*\}\}|\{[\{%#]/';

	private mixed $pathCsv;
	private array $options = array();
	private array $langDb = array();
	private array $langList = array();
	private array $langMap = array(); // 正規化した言語コード => 列名
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
		return $this->getFor($this->lang, $key, $bindData, $defaultValue);
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
					// get() のバインドデータと同じように列挙して、浅くコピーする
					// (オブジェクトは公開プロパティ、Traversable はその要素。Generator はここで消費する)
					$bind = array();
					foreach( $value as $bindKey => $bindValue ){
						$bind[$bindKey] = $bindValue;
					}
					$value = $bind;
					break;
				case 'template':
					if( !is_bool($value) ){
						throw new LangBankException('INVALID_OPTION', 'Option "template" must be a boolean.');
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
	 *
	 * PHP 8.3 以降の fgetcsv($fp, 0, ',', '"', '') と同じ結果を返す。
	 * (fgetcsv() そのものは、PHP のバージョンやロケールによって不正な CSV の結果が変わるため、
	 * php-src の php_fgetcsv() を移植した。NodeJS版の libs/parseCsv.js と同じアルゴリズム)
	 * 区切り文字と引用符は ASCII なので、マルチバイト文字はバイト単位で扱っても結果は同じ。
	 */
	private function parseCsv( $src ){
		$src = preg_replace('/^\xEF\xBB\xBF/', '', $src);
		if( strpos($src, "\n") === false ){
			// CR だけで改行された CSV
			$src = str_replace("\r", "\n", $src);
		}

		// LF までを 1 行として (LF を含めて) 読む
		$pos = 0;
		$length = strlen($src);
		$nextLine = function() use ( $src, $length, &$pos ){
			if( $pos >= $length ){
				return null;
			}
			$end = strpos($src, "\n", $pos);
			$end = ($end === false) ? $length : $end + 1;
			$line = substr($src, $pos, $end - $pos);
			$pos = $end;
			return $line;
		};

		$rtn = array();
		while( !is_null($line = $nextLine()) ){
			$rtn[] = $this->parseCsvRow($line, $nextLine);
		}
		return $rtn;
	}

	/**
	 * CSV の 1 行 (引用符の中に改行があれば、続く行も) を読んで、セルの配列を返す
	 *
	 * 空行は [null] を返す (fgetcsv() と同じ)。
	 * 文字列の末尾を越えた位置の文字は '' になり、C の終端文字と同じように、区切り文字にも引用符にもならない。
	 */
	private function parseCsvRow( string $buf, \Closure $nextLine ): array{
		$limit = $this->trimCsvLineEnd($buf);
		$lineEnd = substr($buf, $limit);
		$ptr = 0;
		$firstField = true;
		$row = array();

		do{
			$field = '';

			$inc = ($ptr < $limit) ? 1 : 0;
			if( $inc === 1 ){
				// 引用符の前の空白は読み飛ばす (C ロケールの isspace())
				$tmp = $ptr;
				while( ($buf[$tmp] ?? '') !== ',' && ($buf[$tmp] ?? '') !== '' && strpos(" \t\n\r\v\f", ($buf[$tmp] ?? '')) !== false ){
					$tmp ++;
				}
				if( ($buf[$tmp] ?? '') === '"' && $tmp < $limit ){
					$ptr = $tmp;
				}
			}

			if( $firstField && $ptr === $limit ){
				// 空行
				return array(null);
			}
			$firstField = false;

			if( $inc !== 0 && ($buf[$ptr] ?? '') === '"' ){
				// 引用符で囲まれたセル
				// (エスケープ文字を使わないので、状態は 0: 通常 と 2: 直前が引用符 だけ)
				$state = 0;
				$ptr ++;
				$hunk = $ptr;
				for(;;){
					if( $inc === 0 ){
						if( $state === 2 ){
							// 行末の閉じる引用符
							$field .= substr($buf, $hunk, $ptr - 1 - $hunk);
							$hunk = $ptr;
							break;
						}
						if( $hunk !== $limit ){
							$field .= substr($buf, $hunk, $ptr - $hunk);
							$hunk = $ptr;
						}
						// 引用符の中の改行は、セルの値に含めて次の行を読む
						$field .= $lineEnd;
						$next = $nextLine();
						if( is_null($next) ){
							// 閉じていない引用符は、末尾までを 1 つのセルにする
							if( $ptr > $limit ){
								if( $hunk === $ptr ){
									$hunk --;
								}
								$ptr --;
							}
							break;
						}
						$buf = $next;
						$ptr = 0;
						$hunk = 0;
						$limit = $this->trimCsvLineEnd($buf);
						$lineEnd = substr($buf, $limit);
						$state = 0;
					}elseif( $state === 2 ){
						if( ($buf[$ptr] ?? '') !== '"' ){
							// 閉じる引用符
							$field .= substr($buf, $hunk, $ptr - 1 - $hunk);
							$hunk = $ptr;
							break;
						}
						// "" は " にする
						$field .= substr($buf, $hunk, $ptr - $hunk);
						$ptr ++;
						$hunk = $ptr;
						$state = 0;
					}else{
						if( ($buf[$ptr] ?? '') === '"' ){
							$state = 2;
						}
						$ptr ++;
					}
					$inc = ($ptr < $limit) ? 1 : 0;
				}

				// 閉じる引用符の後ろは、次の区切り文字までをそのまま加える
				while( $inc !== 0 && ($buf[$ptr] ?? '') !== ',' ){
					$ptr ++;
					$inc = ($ptr < $limit) ? 1 : 0;
				}
				$field .= substr($buf, $hunk, max(0, $ptr - $hunk));
				$ptr += $inc;
			}else{
				// 引用符で囲まれていないセル
				$hunk = $ptr;
				while( $inc !== 0 && ($buf[$ptr] ?? '') !== ',' ){
					$ptr ++;
					$inc = ($ptr < $limit) ? 1 : 0;
				}
				$field = substr($buf, $hunk, $ptr - $hunk);
				$field = substr($field, 0, $this->trimCsvLineEnd($field));
				if( ($buf[$ptr] ?? '') === ',' ){
					$ptr ++;
				}
			}

			$row[] = $field;
		}while( $inc > 0 );

		return $row;
	}

	/**
	 * 末尾の改行 (\r\n, \n, \r のいずれか 1 つ) を除いた長さを返す
	 */
	private function trimCsvLineEnd( string $str ): int{
		$len = strlen($str);
		if( $len && $str[$len - 1] === "\n" ){
			return ($len > 1 && $str[$len - 2] === "\r") ? $len - 2 : $len - 1;
		}
		if( $len && $str[$len - 1] === "\r" ){
			return $len - 1;
		}
		return $len;
	}

	/**
	 * パース済みのCSV配列を検証する
	 *
	 * 辞書は変更しない。空のCSVなら null、そうでなければ {rows, header} を返す。
	 * header は、列のインデックス => 言語名 (言語の列だけ)。
	 * 訳文に予約した構文があれば、TEMPLATE_ERROR を投げる。
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

		if( ($this->options['template'] ?? true) !== false ){
			// 訳文の予約した構文は、表示する前に (読み込み時に) 見つける
			foreach( array_slice($rows, 1) as $row ){
				$key = ''.$row[0];
				if( $key === '' ){
					continue;
				}
				foreach( $header as $idx => $lang ){
					$cell = ''.($row[$idx] ?? '');
					$offset = $this->findReservedSyntax($cell);
					if( $offset >= 0 ){
						throw $this->reservedSyntaxError($cell, $offset, $this->describeTemplate(false, $key, $lang));
					}
				}
			}
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
	 */
	private function getFor( ?string $lang, $key, $bindData, $defaultValue ): string{
		if( is_string($bindData) && is_null($defaultValue) ){
			// 第 2 引数の文字列はデフォルト値
			$defaultValue = $bindData;
			$bindData = null;
		}
		$key = ''.$key;

		$value = $this->findValue($key, $lang, true);
		if( !is_null($value) ){
			return $this->render($value, $bindData, false, $key, $lang);
		}
		if( is_string($defaultValue) ){
			return $this->render($defaultValue, $bindData, true, $key, $lang);
		}
		if( isset($this->options['onMissing']) ){
			$missing = call_user_func($this->options['onMissing'], $key, $lang);
			if( is_string($missing) ){
				return $missing;
			}
		}
		return $key;
	}

	/**
	 * 指定した言語で has() する
	 */
	private function hasFor( ?string $lang, $key, ?array $options ): bool{
		return !is_null($this->findValue(''.$key, $lang, $this->useFallbackForHas($options)));
	}

	/**
	 * プレースホルダー ({{ name }}) を、バインドデータの値で置き換える
	 *
	 * 1 回の走査で置き換え、差し込んだ値はもう一度処理しない。
	 * バインドデータは、get() のデータ > options.bind の順で探す。
	 */
	private function render( string $template, $bindData, bool $isDefault, string $key, ?string $lang ): string{
		if( ($this->options['template'] ?? true) === false || strpos($template, '{') === false ){
			return $template;
		}

		$bind = $this->options['bind'] ?? array();
		if( is_array($bindData) || is_object($bindData) ){
			// 配列の要素、オブジェクトの公開プロパティ、Traversable の要素
			foreach( $bindData as $bindDataKey => $bindDataValue ){
				$bind[$bindDataKey] = $bindDataValue;
			}
		}

		return preg_replace_callback(self::PLACEHOLDER_PATTERN, function( $matched ) use ( $template, $bind, $isDefault, $key, $lang ){
			$name = $matched[1][0] ?? ''; // 予約した構文にマッチしたときは、グループがない
			if( $name === '' ){
				throw $this->reservedSyntaxError($template, $matched[0][1], $this->describeTemplate($isDefault, $key, $lang));
			}
			return $this->toPlaceholderValue($bind[$name] ?? null, $name, $this->describeTemplate($isDefault, $key, $lang));
		}, $template, -1, $count, PREG_OFFSET_CAPTURE);
	}

	/**
	 * 予約した構文のうち、正しいプレースホルダーにならないものの位置 (バイト単位) を返す (なければ -1)
	 */
	private function findReservedSyntax( string $template ): int{
		if( strpos($template, '{') === false ){
			return -1;
		}
		preg_match_all(self::PLACEHOLDER_PATTERN, $template, $matches, PREG_SET_ORDER|PREG_OFFSET_CAPTURE);
		foreach( $matches as $matched ){
			if( ($matched[1][0] ?? '') === '' ){
				return $matched[0][1];
			}
		}
		return -1;
	}

	/**
	 * 訳文やデフォルト値のエラーメッセージ用に、場所を説明する
	 */
	private function describeTemplate( bool $isDefault, string $key, ?string $lang ): string{
		return ($isDefault ? 'the default value' : 'the word').' of key "'.$key.'" (lang: '.$lang.')';
	}

	/**
	 * 予約した構文のエラー
	 */
	private function reservedSyntaxError( string $template, int $offset, string $where ): LangBankException{
		return new LangBankException('TEMPLATE_ERROR', 'Unsupported syntax in '.$where.': "'.mb_substr(substr($template, $offset), 0, 20).'". Only placeholders like {{ name }} are supported.');
	}

	/**
	 * プレースホルダーに差し込む値を文字列にする
	 */
	private function toPlaceholderValue( mixed $value, string $name, string $where ): string{
		if( is_null($value) ){
			return '';
		}
		if( is_string($value) ){
			return $value;
		}
		if( is_int($value) || is_float($value) ){
			return (string) $value;
		}
		if( is_bool($value) ){
			return $value ? '1' : '';
		}
		throw new LangBankException('TEMPLATE_ERROR', 'Unsupported type of the value "'.$name.'" ('.get_debug_type($value).') in '.$where.'.');
	}

	/**
	 * 言語を固定したビューを作る
	 *
	 * withLang() で使う。(サブクラスでオーバーライドされた withLang() を経由しない)
	 */
	private function createView( ?string $lang ): LangBankView{
		// LangBankView のコンストラクタは private なので、そのクラスのスコープに束縛したクロージャで生成する
		// (内部処理のクロージャは、LangBank のスコープで作る)
		$factory = \Closure::bind(static function( ?string $lang, array $fns ): LangBankView{
			return new LangBankView($lang, $fns);
		}, null, LangBankView::class);
		return $factory($lang, array(
			'get' => function( $key, $bindData, $defaultValue ) use ( $lang ){
				return $this->getFor($lang, $key, $bindData, $defaultValue);
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

}
