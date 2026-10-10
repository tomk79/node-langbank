/**
 * langbank.js
 */

/**
 * メソッドはインスタンスごとに定義される (切り離して呼べる) ため、
 * サブクラスでメソッドをオーバーライドしても使われない。拡張にはラッパーを使う。
 */
declare class LangBank {
	/**
	 * @param src 読み込み元 (ファイルパス, CSV 文字列, パース済みの CSV 配列, またはそれらの配列)。省略すると空の辞書
	 * @throws {LangBank.LangBankError} 読み込みに失敗した場合や、オプションが不正な場合
	 * @throws {TypeError} options が null, undefined, 配列以外のオブジェクトのいずれでもない場合 (配列は TypeError。関数は非推奨のコールバック)
	 */
	constructor(src?: LangBank.Source, options?: LangBank.Options | null);
	/**
	 * @deprecated 初期化は同期で終わるので、コールバックは不要。互換のために残している
	 * @param callback 初期化後に非同期で呼ばれる
	 */
	constructor(src: LangBank.Source, callback: (() => void) | null);
	/**
	 * @deprecated 初期化は同期で終わるので、コールバックは不要。互換のために残している
	 * @param callback 初期化後に非同期で呼ばれる
	 */
	constructor(src: LangBank.Source, options: LangBank.Options | null | undefined, callback: (() => void) | null);

	/** 現在の言語 (getLang() と同じ) */
	readonly lang: string | null;
	/** デフォルト言語 (getDefaultLang() と同じ) */
	readonly defaultLang: string | null;

	/**
	 * 言語を設定する (null/undefined は null、それ以外は文字列にして保存する)
	 * @returns 辞書にその言語 (またはフォールバック先) があれば true。resolveLang(lang) !== null と同じ
	 */
	setLang(lang: string | null | undefined): boolean;

	getLang(): string | null;

	/** デフォルト言語 (最初に読み込んだ CSV の、最初の言語の列) */
	getDefaultLang(): string | null;

	/** 辞書にある言語の列名 */
	getLangList(): string[];

	/**
	 * 言語を辞書の列名に解決する
	 *
	 * 指定した言語, options.fallback, サブタグを削った言語の順で、辞書にある最初の列名を返す。
	 * セルの内容は調べず、デフォルト言語へのフォールバックも含めない。見つからなければ null。
	 * @param lang 省略 (undefined) すると現在の言語。null は言語の指定なしとして null を返す
	 */
	resolveLang(lang?: string | null): string | null;

	/**
	 * 訳文を取得する
	 *
	 * 第 2 引数が文字列で、第 3 引数が null か undefined なら、第 2 引数をデフォルト値として扱う。
	 * 訳文が見つからず (フォールバックを含む)、デフォルト値もなければ、onMissing の戻り値、またはキーを返す。
	 * @throws {TypeError} キーが文字列でも数値でもない場合
	 */
	get(key: LangBank.Key): string;
	get(key: LangBank.Key, defaultValue: string): string;
	get(key: LangBank.Key, bindData: LangBank.BindData | null | undefined, defaultValue?: string | null): string;
	get(key: LangBank.Key, bindDataOrDefault?: LangBank.BindData | string | null, defaultValue?: string | null): string;

	/**
	 * 現在の言語 (既定ではフォールバックを含む) で訳文が見つかれば true
	 * @throws {TypeError} キーが文字列でも数値でもない場合や、options が null, undefined, 配列以外のオブジェクトのいずれでもない場合
	 * @throws {LangBank.LangBankError} options に未知のキーや不正な値がある場合 (INVALID_OPTION)
	 */
	has(key: LangBank.Key, options?: LangBank.HasOptions | null): boolean;

	/**
	 * 言語を固定した、読み取り専用のビュー。辞書は共有する
	 * @param lang null (undefined も null と同じ) ならデフォルト言語だけを探すビュー。省略はできない (現在の言語の意味にはならない)
	 */
	withLang(lang: string | null | undefined): LangBank.View;

	/** 辞書のコピー。すべてのキーが getLangList() のすべての言語を持つ (訳文がなければ '') */
	getList(): { [key: string]: { [lang: string]: string } };

	/** 辞書を追加で読み込み、セル単位の後勝ちでマージする。エラーの場合は辞書を変えない */
	load(src: LangBank.Source): this;
}

declare namespace LangBank {
	type CsvCell = string | number | boolean | null | undefined;
	type CsvArray = Array<CsvCell[] | null | undefined>;
	type Source = string | CsvArray | Array<string | CsvArray | null | undefined> | null | undefined;
	type BindData = { [key: string]: any };
	/** キー (数値は文字列にして探す) */
	type Key = string | number;
	type AutoescapeStrategy = 'html' | 'js' | 'css' | 'url' | 'html_attr';

	interface Options {
		/** すべての get() でバインドするデータ */
		bind?: BindData | null;
		/** HTML エスケープの戦略 (既定: false。true は 'html') */
		autoescape?: boolean | AutoescapeStrategy | null;
		/** false にすると Twig で評価しない (既定: true) */
		twig?: boolean | null;
		/**
		 * 訳文が見つからず (フォールバックを含む)、デフォルト値もない場合の戻り値を返す (文字列以外を返すとキーを使う)
		 *
		 * lang は、その get() の言語 (初期言語, setLang() または withLang() で設定した値)。列名に解決する前の値で、null のこともある。
		 */
		onMissing?: ((key: string, lang: string | null) => string | void | null | undefined) | null;
		/** 言語ごとのフォールバック先 */
		fallback?: { [lang: string]: string | string[] } | null;
	}

	interface HasOptions {
		/** true にすると、その言語の列だけを探す (既定: false) */
		exact?: boolean | null;
	}

	/** withLang() が返す、言語を固定したビュー。テンプレートの _ENV と同じ形 */
	interface View {
		readonly lang: string | null;
		readonly defaultLang: string | null;
		get(key: Key): string;
		get(key: Key, defaultValue: string): string;
		get(key: Key, bindData: BindData | null | undefined, defaultValue?: string | null): string;
		get(key: Key, bindDataOrDefault?: BindData | string | null, defaultValue?: string | null): string;
		/**
		 * @throws {TypeError} キーが文字列でも数値でもない場合や、options が null, undefined, 配列以外のオブジェクトのいずれでもない場合
		 * @throws {LangBankError} options に未知のキーや不正な値がある場合 (INVALID_OPTION)
		 */
		has(key: Key, options?: HasOptions | null): boolean;
		/** 省略 (undefined) するとビューの言語 */
		resolveLang(lang?: string | null): string | null;
		getLang(): string | null;
		getDefaultLang(): string | null;
		getLangList(): string[];
	}

	type ErrorCode =
		| 'FILE_NOT_FOUND'
		| 'FILE_READ_ERROR'
		| 'INVALID_SOURCE'
		| 'INVALID_CSV'
		| 'CSV_PARSE_ERROR'
		| 'TEMPLATE_ERROR'
		| 'CIRCULAR_REFERENCE'
		| 'INVALID_OPTION';

	class LangBankError extends Error {
		constructor(code: ErrorCode, message: string, cause?: unknown);
		code: ErrorCode;
		cause?: unknown;

		static readonly FILE_NOT_FOUND: 'FILE_NOT_FOUND';
		static readonly FILE_READ_ERROR: 'FILE_READ_ERROR';
		static readonly INVALID_SOURCE: 'INVALID_SOURCE';
		static readonly INVALID_CSV: 'INVALID_CSV';
		static readonly CSV_PARSE_ERROR: 'CSV_PARSE_ERROR';
		static readonly TEMPLATE_ERROR: 'TEMPLATE_ERROR';
		static readonly CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE';
		static readonly INVALID_OPTION: 'INVALID_OPTION';
	}
}

export = LangBank;
