<?php
/**
 * langbank.php
 */
namespace tomk79;

/**
 * LangBank のエラー
 */
class LangBankException extends \RuntimeException{

	public const FILE_NOT_FOUND = 'FILE_NOT_FOUND';
	public const FILE_READ_ERROR = 'FILE_READ_ERROR';
	public const INVALID_SOURCE = 'INVALID_SOURCE';
	public const INVALID_CSV = 'INVALID_CSV';
	/** PHP版では投げない (NodeJS版と揃えるために定義している) */
	public const CSV_PARSE_ERROR = 'CSV_PARSE_ERROR';
	public const TEMPLATE_ERROR = 'TEMPLATE_ERROR';
	public const CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE';
	public const INVALID_OPTION = 'INVALID_OPTION';

	/** エラーコード */
	private string $errorCode;

	/**
	 * constructor
	 *
	 * @param string $errorCode エラーコード
	 * @param string $message メッセージ
	 * @param \Throwable|null $previous 元の例外
	 */
	public function __construct( string $errorCode, string $message, ?\Throwable $previous = null ){
		parent::__construct($message, 0, $previous);
		$this->errorCode = $errorCode;
	}

	/**
	 * エラーコードを取得する
	 *
	 * @return string エラーコード (このクラスの定数のいずれか)
	 */
	public function getErrorCode(): string{
		return $this->errorCode;
	}

}
