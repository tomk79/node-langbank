# node-langbank

## Install

```
$ npm install --save langbank
```

## Usage

```js
var LangBank = require('langbank');
var lb = new LangBank('/path/to/list.csv', function(){
	lb.setLang('en');
	console.log( lb.get('hello') ); // <- "Hello"
});


// initialize with options
var LangBank = require('langbank');
var lb = new LangBank(
	'/path/to/list.csv',
	{},
	function(){
		lb.setLang('en');
		console.log( lb.get('hello') ); // <- "Hello"
	}
);
```

list.csv
```csv
"","en","ja","anylang"
"goodmorning","Good Morning!","おはよう！","good morning in anylang"
"hello","Hello","こんにちわ","hello in anylang"
```

## Change Log

### langbank@0.0.2 (2016-??-??)

- 選択された言語の単語が登録されていない場合に、デフォルト言語を参照するようになった。
- 単語の登録がない場合に、文字列 `---` を返すようになった。

### langbank@0.0.1 (2016-08-20)

- initial release.

## License

MIT License


## Author

- Tomoya Koyanagi <tomk79@gmail.com>
- website: <http://www.pxt.jp/>
- Twitter: @tomk79 <http://twitter.com/tomk79/>
