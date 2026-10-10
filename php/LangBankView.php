<?php
/**
 * langbank.php
 */
namespace tomk79;

/**
 * 言語を固定した、読み取り専用のビュー
 *
 * LangBank::withLang() が返す。辞書は元の LangBank と共有する。
 */
final class LangBankView{

	private ?string $viewLang;
	/** @var array<string, \Closure> LangBank の内部処理 */
	private array $fns;

	/**
	 * constructor
	 *
	 * @internal LangBank::withLang() を使うこと
	 * @param string|null $lang このビューの言語
	 * @param array<string, \Closure> $fns LangBank の内部処理 (get, has, resolveLang, getDefaultLang, getLangList)
	 */
	public function __construct( ?string $lang, array $fns ){
		$this->viewLang = $lang;
		$this->fns = $fns;
	}

	/**
	 * get word by key
	 *
	 * @see LangBank::get()
	 */
	public function get( string|int $key, mixed $bindData = null, mixed $defaultValue = null ): string{
		return ($this->fns['get'])($key, $bindData, $defaultValue);
	}

	/**
	 * has word
	 *
	 * @see LangBank::has()
	 */
	public function has( string|int $key, ?array $options = null ): bool{
		return ($this->fns['has'])($key, $options);
	}

	/**
	 * 言語を辞書の列名に解決する
	 *
	 * @see LangBank::resolveLang()
	 * @param string|null $lang 言語コード。省略するとこのビューの言語
	 */
	public function resolveLang( ?string $lang = null ): ?string{
		return ($this->fns['resolveLang'])(func_num_args() ? $lang : $this->viewLang);
	}

	/**
	 * get Language
	 *
	 * @return string|null このビューの言語
	 */
	public function getLang(): ?string{
		return $this->viewLang;
	}

	/**
	 * get default Language
	 *
	 * @return string|null デフォルト言語
	 */
	public function getDefaultLang(): ?string{
		return ($this->fns['getDefaultLang'])();
	}

	/**
	 * get language list
	 *
	 * @return array 辞書にある言語の列名
	 */
	public function getLangList(): array{
		return ($this->fns['getLangList'])();
	}

}
