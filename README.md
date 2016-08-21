# node-langbank

## Install

```
$ npm install --save langbank
```

## Basic Usage

```js
var LangBank = require('langbank');
var lb = new LangBank('/path/to/list.csv', function(){
	lb.setLang('en');
	console.log( lb.get('hello') ); // <- "Hello"
});
```

list.csv
```csv
"","en","ja","anylang"
"goodmorning","Good Morning!","おはよう！","good morning in anylang"
"hello","Hello","こんにちわ","hello in anylang"
```

Using 2nd column as Default Language.


### Using EJS

You can use "EJS" template.

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

list.csv
```csv
"","en"
"goodmorning","Good <%= sample %>!"
```

#### \_ENV in EJS

langbank object is accessable in "EJS" template as `_ENV` .

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

list.csv
```csv
"","en"
"morning","Morning"
"goodmorning","Good <%= _ENV.get('morning') %>!"
```


## Change Log

### langbank@0.0.2 (2016-08-21)

- 選択された言語の単語が登録されていない場合に、デフォルト言語を参照するようになった。
- 単語の登録がない場合に、文字列 `---` を返すようになった。
- 単語中で EJS テンプレートを使えるようになった。
- 第1引数は、CSVファイルのパスのほか、CSVフォーマットの文字列を受け取れるようになった。

### langbank@0.0.1 (2016-08-20)

- initial release.

## License

MIT License


## Author

- Tomoya Koyanagi <tomk79@gmail.com>
- website: <http://www.pxt.jp/>
- Twitter: @tomk79 <http://twitter.com/tomk79/>
