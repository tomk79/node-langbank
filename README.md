# node-langbank

## Install

NodeJS:

```
$ npm install --save langbank;
```

PHP:

```
$ composer require tomk79/langbank;
```


## Basic Usage

NodeJS:

```js
var LangBank = require('langbank');
var lb = new LangBank('/path/to/list.csv', function(){
	lb.setLang('en');
	console.log( lb.get('hello') ); // <- "Hello"
});
```

PHP:

```php
require_once('/path/to/vendor/autoload.php');
$lb = new tomk79\LangBank('/path/to/list.csv');
$lb->setLang( 'en' );
$lb->get('hello'); // <- "Hello"
```

list.csv:

```csv
"","en","ja","anylang"
"goodmorning","Good Morning!","おはよう！","good morning in anylang"
"hello","Hello","こんにちわ","hello in anylang"
```

Using 2nd column as Default Language.


### Using Twig

Can use "Twig" template.

NodeJS:

```js
var LangBank = require('langbank');
var lb = new LangBank(
	'/path/to/list.csv',
	{
		"bind":{
			"sample": "Morning"
		}
	},
	function(){
		lb.setLang('en');
		console.log( lb.get('goodmorning') ); // <- "Good Morning!"
	}
);
```

list.csv:

```csv
"","en"
"goodmorning","Good {{ sample }}!"
```

Can bind temporary data with "Twig".

NodeJS:

```js
var LangBank = require('langbank');
var lb = new LangBank(
	'/path/to/list.csv',
	function(){
		lb.setLang('en');
		console.log( lb.get('goodfoobar', {"sample": "Evening"}) ); // <- "Good Evening!"
	}
);
```

list.csv:

```csv
"","en"
"goodfoobar","Good {{ sample }}!"
```


#### \_ENV in Twig

langbank object is accessable in "Twig" template as `_ENV` .

NodeJS:

```js
var LangBank = require('langbank');
var lb = new LangBank(
	'/path/to/list.csv',
	function(){
		lb.setLang('en');
		console.log( lb.get('goodmorning') ); // <- "Good Morning!"
	}
);
```

list.csv:

```csv
"","en"
"morning","Morning"
"goodmorning","Good {{ _ENV.get('morning') }}!"
```


## Change Log

### langbank v0.3.0 (リリース日未定)

- `get()` は、第2引数にバインドするデータを受け取れるようになった。

### langbank v0.2.2 (2022-09-25)

- NodeJS版, PHP版: `get()` で、要求された言語版の翻訳がない場合に、デフォルト言語を返せない場合がある不具合を修正。

### langbank v0.2.1 (2022-06-05)

- NodeJS版: ブラウザ上で動かす場合にロードできない場合がある問題を修正。

### langbank v0.2.0 (2022-01-08)

- PHP版: サポートするPHPのバージョンを `>=7.3.0` に変更。PHP 8.1 に対応した。

### langbank v0.1.1 (2021-11-29)

- NodeJS版: 初期化時に与えられる第1引数が `null` や `undefined` だった場合に異常終了する問題を修正。

### langbank v0.1.0 (2021-11-28)

- `get()` に、第2引数 `$defaultValue` を追加。
- NodeJS版: ejs を廃止し、 Twig に対応した。

### langbank v0.0.5 (2021-04-23)

- `getLang()` メソッドを追加。
- 内部コードの細かい修正。

### langbank v0.0.4 (2019-12-30)

- PHP版が、Twig 3.0 系に対応。

### langbank v0.0.3 (2018-05-24)

- 実験的に、PHP版を追加。

### langbank v0.0.2 (2016-08-21)

- 選択された言語の単語が登録されていない場合に、デフォルト言語を参照するようになった。
- 単語の登録がない場合に、文字列 `---` を返すようになった。
- 単語中で EJS テンプレートを使えるようになった。
- 第1引数は、CSVファイルのパスのほか、CSVフォーマットの文字列を受け取れるようになった。

### langbank v0.0.1 (2016-08-20)

- initial release.

## License

MIT License


## Author

- Tomoya Koyanagi <tomk79@gmail.com>
- website: <https://www.pxt.jp/>
- Twitter: @tomk79 <https://twitter.com/tomk79/>
