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
	private \Closure $getFn;
	private \Closure $hasFn;
	private \Closure $defaultLangFn;

	/**
	 * constructor
	 *
	 * @internal LangBank::withLang() を使うこと
	 */
	public function __construct( ?string $lang, \Closure $getFn, \Closure $hasFn, \Closure $defaultLangFn ){
		$this->viewLang = $lang;
		$this->getFn = $getFn;
		$this->hasFn = $hasFn;
		$this->defaultLangFn = $defaultLangFn;
	}

	/**
	 * get word by key
	 *
	 * @see LangBank::get()
	 */
	public function get( string|int $key, mixed $bindData = null, mixed $defaultValue = null ): string{
		return ($this->getFn)($key, $bindData, $defaultValue);
	}

	/**
	 * has word
	 *
	 * @see LangBank::has()
	 */
	public function has( string|int $key, ?array $options = null ): bool{
		return ($this->hasFn)($key, $options);
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
		return ($this->defaultLangFn)();
	}

}
