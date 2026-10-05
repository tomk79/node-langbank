# node-langbank

A simple multilingual dictionary library for Node.js and PHP.
Write your words in a CSV file, and get them in the current language. Words can be [Twig](https://twig.symfony.com/) templates.

## Install

NodeJS:

```
$ npm install --save langbank;
```

PHP:

```
$ composer require tomk79/langbank;
```

Requirements: Node.js >= 14 / PHP >= 8.1 (with mbstring)


## Basic Usage

list.csv:

```csv
"","en","ja","anylang"
"goodmorning","Good Morning!","おはよう！","good morning in anylang"
"hello","Hello","こんにちわ","hello in anylang"
```

- The first row is the header: the 1st column is ignored, and the rest are language codes.
- The first language column (normally the 2nd column) is the **default language**. It is also the initial language.
- Each following row is a word: the 1st column is the key, and the rest are the words for each language.

NodeJS:

```js
const LangBank = require('langbank');   // or: import LangBank from 'langbank';
const lb = new LangBank('/path/to/list.csv');
lb.setLang('ja');
console.log( lb.get('hello') ); // <- "こんにちわ"
```

The constructor loads the dictionary synchronously. The callback style of v0.x and a Promise style are also available:

```js
const lb = new LangBank('/path/to/list.csv', function(){
	lb.setLang('en');
	console.log( lb.get('hello') ); // <- "Hello"
});

const lb2 = new LangBank('/path/to/list.csv');
await lb2.ready();
```

PHP:

```php
require_once('/path/to/vendor/autoload.php');
$lb = new tomk79\LangBank('/path/to/list.csv');
$lb->setLang( 'en' );
$lb->get('hello'); // <- "Hello"
```


## Sources

The 1st argument of the constructor (and of `load()`) accepts the following. NodeJS and PHP behave the same way.

| Source | Treated as |
|---|---|
| `null`, `undefined`, `''`, `[]` | An empty dictionary. |
| A string that contains a line break (`\n` or `\r`) | CSV text. |
| A string without line breaks | A file path. Throws `FILE_NOT_FOUND` if the file does not exist. |
| A 2-dimensional array | Parsed CSV rows. Each row must be an array (or `null`), and each cell must be a scalar value (or `null`). |
| An array of the above (strings and/or 2-dimensional arrays) | Multiple sources, merged in order. |

```js
new LangBank('/path/to/list.csv');
new LangBank('"","en","ja"\n"hello","Hello","こんにちは"');
new LangBank([["", "en", "ja"], ["hello", "Hello", "こんにちは"]]);
new LangBank(['/path/to/common.csv', '/path/to/app.csv']);
```

- A UTF-8 BOM, and CRLF or CR line breaks are accepted. Rows may have different numbers of columns.
- A backslash is not an escape character (RFC 4180). Write `""` for a double quote in a quoted cell.
- Files must be in UTF-8. In PHP, Shift_JIS and EUC-JP files are also detected and converted.

### Multiple dictionaries

Pass an array of sources, or add a dictionary later with `load()`:

```js
const lb = new LangBank(['/path/to/common.csv', '/path/to/app.csv']);
lb.load('/path/to/plugin.csv');
```

They are merged **cell by cell, and later wins**: a non-empty cell overwrites the existing word, and an empty cell never does. So you can put, for example, only the Japanese column in another file. Duplicated keys within one file are merged in the same way.

The default language is the first language column of the first loaded CSV. Loading more CSV files does not change the default language or the current language.


## get()

```js
lb.get(key);                        // the word
lb.get(key, 'default value');       // 2nd argument is a string: the default value
lb.get(key, {name: 'Tom'});         // 2nd argument is not a string: the bind data
lb.get(key, {name: 'Tom'}, 'default value');
lb.get(key, null, 'default value');
```

The default value must be a string. Any other type (`null`, `false`, a number, ...) is treated as not given.

### Fallback of languages

When the word for the current language is empty or undefined, `get()` looks for it in the following order:

1. The current language.
2. The languages given by `options.fallback` for the current language.
3. The current language with its last subtag removed, repeatedly. (`zh-Hant-TW` → `zh-Hant` → `zh`)
4. The default language.

Language codes are compared case-insensitively, and `_` is treated as `-`. So `setLang('ja_JP')` finds the `ja` column. If two columns are the same in this comparison (e.g. `en` and `EN`), only the first one is used.

```js
const lb = new LangBank('/path/to/list.csv', {
	"fallback": {
		"zh-HK": ["zh-TW", "zh-Hant"],
		"pt-BR": ["pt"]
	}
});
```

`setLang()` always sets the language, and returns `false` if the dictionary has neither the language nor any of its fallback languages (except the default language). `getLangList()` returns the languages in the dictionary.

### Missing keys

When no word is found, `get()` returns:

1. The default value, if given (an empty string `''` is returned as is).
2. Otherwise, the return value of `options.onMissing(key, lang)`, if given.
3. Otherwise, **the key itself**.

```js
const lb = new LangBank('/path/to/list.csv', {
	"onMissing": function(key, lang){
		console.warn('Missing word:', key, lang);
		return key;
	}
});
lb.has('hello'); // <- true if a word is found
```


## Using Twig

Words can be Twig templates. Twig is used only when a word contains `{{`, `{%` or `{#`.

list.csv:

```csv
"","en"
"goodmorning","Good {{ sample }}!"
```

Bind data for every `get()` with `options.bind`, or for one `get()` with its 2nd argument:

```js
const lb = new LangBank('/path/to/list.csv', {
	"bind": {
		"sample": "Morning"
	}
});
lb.get('goodmorning'); // <- "Good Morning!"
lb.get('goodmorning', {"sample": "Evening"}); // <- "Good Evening!"
```

The default value is also a Twig template:

```js
lb.get('undefinedKey', {"name": "Tom"}, 'Hello, {{ name }}!'); // <- "Hello, Tom!"
```

### \_ENV in Twig

The LangBank object is accessible in Twig templates as `_ENV`.

```csv
"","en"
"morning","Morning"
"goodmorning","Good {{ _ENV.get('morning') }}!"
"currentlang","Current language is {{ _ENV.lang }}."
```

### Writing `{{` literally

Use the `verbatim` tag (it works in both NodeJS and PHP):

```csv
"","en"
"example","{% verbatim %}Write {{ name }} to insert a name.{% endverbatim %}"
```

Or disable Twig entirely with `"twig": false`.

### HTML escaping

By default, words are **not** HTML-escaped: LangBank returns plain strings, and escaping is the job of the output side (your template engine, etc.). To escape the bound values in the Twig templates, set `"autoescape": "html"`.

### Security

Words are evaluated as Twig templates. Do not load CSV files from untrusted sources, or set `"twig": false` if you have to.


## Options

| Option | Default | Description |
|---|---|---|
| `bind` | `{}` | Data bound to all Twig templates. |
| `autoescape` | `false` | Escaping strategy of Twig (`false`, `"html"`, ...). |
| `twig` | `true` | `false` to return words without evaluating Twig. |
| `onMissing` | (none) | `function(key, lang)` that returns the string for a missing key. |
| `fallback` | `{}` | Fallback languages for each language: `{"lang": ["fallback", ...]}`. |

In PHP, pass the options as an associative array, and `onMissing` as a callable.


## API

| Method | Description |
|---|---|
| `new LangBank(source[, options][, callback])` | Loads the dictionary. Throws on errors. The callback (NodeJS only) is called asynchronously after the initialization. In PHP: `new LangBank($source[, $options])` |
| `setLang(lang)` | Sets the current language. Returns `false` if the dictionary has no such language (see [Fallback of languages](#fallback-of-languages)). |
| `getLang()` | Returns the current language. |
| `getLangList()` | Returns the languages in the dictionary. |
| `get(key[, bindData][, defaultValue])` | Returns the word in the current language. |
| `has(key)` | Returns `true` if a word for the key is found in the current language (including fallback). |
| `getList()` | Returns a copy of the whole dictionary: `{key: {lang: word}}`. |
| `load(source)` | Loads and merges another dictionary. Returns the LangBank object. |
| `ready()` | (NodeJS only) Returns a Promise resolved with the LangBank object. |


## Errors

Errors are thrown as `LangBank.LangBankError` (NodeJS) / `tomk79\LangBankException` (PHP). The error code is `error.code` (NodeJS) / `$e->getErrorCode()` (PHP).

| Code | When |
|---|---|
| `FILE_NOT_FOUND` | The file of the given path does not exist. |
| `FILE_READ_ERROR` | Failed to read the file. |
| `INVALID_SOURCE` | Unsupported type of source, or an invalid row or cell in a CSV array. |
| `INVALID_CSV` | The CSV header has no language columns. |
| `CSV_PARSE_ERROR` | Failed to parse the CSV text (NodeJS only). |
| `TEMPLATE_ERROR` | Failed to render the Twig template in `get()`. The original error is in `error.cause` / `$e->getPrevious()`. |

Even when a callback is given, errors are thrown from the constructor synchronously:

```js
try{
	const lb = new LangBank('/path/to/list.csv', function(){ /* ... */ });
}catch(e){
	console.error(e.code, e.message);
}
```


## Migration from v0.3

v1.0.0 has some breaking changes. To keep the old behavior, see "How to keep the old behavior".

| Change | How to keep the old behavior |
|---|---|
| A missing key returns the key itself, instead of `'---'`. | `"onMissing": function(){ return '---'; }` (PHP: `'onMissing' => function(){ return '---'; }`) |
| `get(key, '')` returns `''`, instead of `'---'`. | Pass `'---'` as the default value. |
| Errors are thrown: a missing file, an invalid source, an invalid CSV, a Twig error in `get()`. (In v0.3, a missing path silently resulted in an empty dictionary in PHP, and was treated as a CSV text in NodeJS. NodeJS returned the raw word on Twig errors.) | Fix the source, or catch the error. A string with line breaks is still treated as CSV text. |
| Duplicated keys in one CSV are merged cell by cell. (In v0.3, a later row replaced the whole earlier row, including its empty cells.) | Remove the duplicated rows. |
| A default value that is not a string is ignored. | Pass a string. |
| PHP: words are no longer HTML-escaped by default. | `'autoescape' => 'html'` |
| NodeJS: `getList()` returns a copy. Modifying it does not change the dictionary. | Use `load()` to add words. |
| `setLang()` returns `false` for a language not in the dictionary (it still sets the language). | — |
| A language like `en-US` now falls back to `en` before the default language. | — |
| PHP: PHP >= 8.1 and Twig `^3.27` are required. NodeJS: Node.js >= 14 and Twig.js `^1.17` are required. | Stay on v0.3. |
| PHP: `{% raw %}` is not available in Twig 2 or later. | Use `{% verbatim %}`. |

The callback style constructor still works, and is still called asynchronously.


## Change Log

### langbank v1.0.0 (リリース日未定)

- 破壊的な変更を含みます。 "Migration from v0.3" を参照してください。
- 未定義のキーに対して、 `---` ではなくキーそのものを返すようになった。 `onMissing` オプションで変更できる。
- 読み込みや Twig の評価に失敗したとき、例外を投げるようになった。
- 改行を含まない文字列をファイルパスとして扱い、ファイルがなければ例外を投げるようになった。
- PHP版: CSV 文字列とパース済みの配列を受け取れるようになった。
- 複数の CSV をマージできるようになった。 `load()` を追加。
- 言語のフォールバックを拡張した (`en-US` → `en` など)。 `fallback` オプションを追加。
- `autoescape`, `twig` オプションを追加。HTML エスケープの既定を、NodeJS版・PHP版ともに無効に統一した。
- `has()`, `getLangList()` を追加。 `setLang()` は、辞書にない言語に対して `false` を返すようになった。
- NodeJS版: 同期で初期化するようになった。 `ready()` を追加。 TypeScript の型定義と ESM に対応。
- NodeJS版: `get()` に渡したバインドデータが、後の呼び出しに残る不具合を修正。
- NodeJS版: コールバックを省略して options を渡すと、例外が発生する不具合を修正。
- NodeJS版: `getList()` が辞書のコピーを返すようになった。
- PHP版: `get()` のバインドデータに `null` を渡すと Warning が発生する不具合を修正。
- PHP版: Shift_JIS のファイルが文字化けする不具合を修正。CR だけで改行された CSV を読めるようになった。 `tomk79/filesystem` への依存を削除。
- サポートする環境を、 Node.js >= 14, Twig.js ^1.17, PHP >= 8.1, Twig ^3.27 に変更。 (PHP 8.0 以前で使える Twig には、すべてセキュリティ勧告が出ているため)

### langbank v0.3.2 (2025-11-16)

- 不具合の修正。

### langbank v0.3.1 (2023-02-05)

- 内部コードの細かい修正。

### langbank v0.3.0 (2022-11-03)

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
