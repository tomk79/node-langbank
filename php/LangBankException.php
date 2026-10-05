<?php
/**
 * langbank.php
 */
namespace tomk79;

/**
 * LangBank のエラー
 */
class LangBankException extends \RuntimeException{

	/** エラーコード */
	private $errorCode;

	/**
	 * constructor
	 *
	 * @param string $errorCode エラーコード
	 * @param string $message メッセージ
	 * @param \Throwable|null $previous 元の例外
	 */
	public function __construct( $errorCode, $message, $previous = null ){
		parent::__construct($message, 0, $previous);
		$this->errorCode = $errorCode;
	}

	/**
	 * エラーコードを取得する
	 *
	 * @return string エラーコード (FILE_NOT_FOUND, FILE_READ_ERROR, INVALID_SOURCE, INVALID_CSV, TEMPLATE_ERROR)
	 */
	public function getErrorCode(){
		return $this->errorCode;
	}

}
