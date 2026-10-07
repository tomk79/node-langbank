/**
 * langbank.js
 */

declare class LangBank {
	/**
	 * @param src 読み込み元 (ファイルパス, CSV 文字列, パース済みの CSV 配列, またはそれらの配列)
	 * @param callback 初期化後に非同期で呼ばれる
	 * @throws {LangBank.LangBankError} 読み込みに失敗した場合
	 */
	constructor(src: LangBank.Source, callback?: (() => void) | null);
	constructor(src: LangBank.Source, options?: LangBank.Options | null, callback?: (() => void) | null);

	/** 現在の言語 (getLang() と同じ) */
	readonly lang: string | null;
	/** デフォルト言語 (getDefaultLang() と同じ) */
	readonly defaultLang: string | null;

	/**
	 * 言語を設定する
	 * @returns 辞書にその言語 (またはフォールバック先) があれば true
	 */
	setLang(lang: string): boolean;

	getLang(): string | null;

	/** デフォルト言語 (最初に読み込んだ CSV の、最初の言語の列) */
	getDefaultLang(): string | null;

	/** 辞書にある言語の列名 */
	getLangList(): string[];

	/**
	 * 訳文を取得する
	 *
	 * 第 2 引数が文字列ならデフォルト値、それ以外ならバインドデータとして扱う。
	 * キーが未定義で、デフォルト値がなければ onMissing の戻り値、またはキーを返す。
	 */
	get(key: string): string;
	get(key: string, defaultValue: string): string;
	get(key: string, bindData: LangBank.BindData | null, defaultValue?: string | null): string;

	/** 現在の言語 (フォールバックを含む) で訳文が見つかれば true */
	has(key: string): boolean;

	/** 辞書のコピー */
	getList(): { [key: string]: { [lang: string]: string } };

	/** 辞書を追加で読み込み、セル単位の後勝ちでマージする */
	load(src: LangBank.Source): this;

	/** 自身で resolve する Promise */
	ready(): Promise<this>;
}

declare namespace LangBank {
	type CsvCell = string | number | boolean | null | undefined;
	type CsvArray = Array<CsvCell[] | null | undefined>;
	type Source = string | CsvArray | Array<string | CsvArray> | null | undefined;
	type BindData = { [key: string]: any };

	interface Options {
		/** すべての get() でバインドするデータ */
		bind?: BindData;
		/** HTML エスケープの戦略 (既定: false) */
		autoescape?: false | true | 'html' | 'js' | string;
		/** false にすると Twig で評価しない (既定: true) */
		twig?: boolean;
		/** キーが未定義だった場合の戻り値を返す (文字列以外を返すとキーを使う) */
		onMissing?: (key: string, lang: string | null) => string | void | null | undefined;
		/** 言語ごとのフォールバック先 */
		fallback?: { [lang: string]: string | string[] };
	}

	type ErrorCode =
		| 'FILE_NOT_FOUND'
		| 'FILE_READ_ERROR'
		| 'INVALID_SOURCE'
		| 'INVALID_CSV'
		| 'CSV_PARSE_ERROR'
		| 'TEMPLATE_ERROR'
		| 'CIRCULAR_REFERENCE';

	class LangBankError extends Error {
		constructor(code: ErrorCode, message: string, cause?: unknown);
		code: ErrorCode;
		cause?: unknown;
	}
}

export = LangBank;
