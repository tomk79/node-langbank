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
```

list.csv
```csv
"key","en","ja","anylang"
"goodmorning","Good Morning!","おはよう！","good morning in anylang"
"hello","Hello","こんにちわ","hello in anylang"
```

## License

MIT License


## Author

- Tomoya Koyanagi <tomk79@gmail.com>
- website: <http://www.pxt.jp/>
- Twitter: @tomk79 <http://twitter.com/tomk79/>
