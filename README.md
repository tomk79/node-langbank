# langbank

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

The constructor loads the dictionary synchronously, so you can use it right away. The callback style of v0.x (`new LangBank(source, options, callback)`) still works, but it is deprecated.

PHP:

```php
require_once('/path/to/vendor/autoload.php');
$lb = new tomk79\LangBank('/path/to/list.csv');
$lb->setLang( 'en' );
$lb->get('hello'); // <- "Hello"
```


## Sources

The 1st argument of the constructor (and of `load()`) accepts the following. NodeJS and PHP behave the same way, except for boolean cells (see below). The 1st argument of the constructor can be omitted (an empty dictionary). That of `load()` is required, but an empty source like `null` loads nothing (and `load()` returns the LangBank object as usual).

| Source | Treated as |
|---|---|
| `null`, `undefined`, `''`, `[]` | An empty dictionary. |
| A string that contains a line break (`\n` or `\r`) | CSV text. |
| A string without line breaks | A file path. Throws `FILE_NOT_FOUND` if the file does not exist. |
| A 2-dimensional array | Parsed CSV rows. Each row must be an array (or `null`), and each cell must be a scalar value (or `null`). |
| An array of the above (strings and/or 2-dimensional arrays) | Multiple sources, merged in order. `null`, `undefined`, `''` and `[]` in the array are skipped. A 2-dimensional array in the list may also have `null` rows. |

```js
new LangBank('/path/to/list.csv');
new LangBank('"","en","ja"\n"hello","Hello","こんにちは"');
new LangBank([["", "en", "ja"], ["hello", "Hello", "こんにちは"]]);
new LangBank(['/path/to/common.csv', '/path/to/app.csv']);
new LangBank(['/path/to/common.csv', isDev ? '/path/to/dev.csv' : null]);
new LangBank(null, {"autoescape": "html"}); // an empty dictionary with options
```

- A UTF-8 BOM, and CRLF or CR line breaks are accepted. Rows may have different numbers of columns.
- A backslash is not an escape character (RFC 4180). Write `""` for a double quote in a quoted cell.
- Files must be in UTF-8. In PHP, Shift_JIS and EUC-JP files are also detected and converted.
- In a 2-dimensional array, a boolean cell is converted to a string in the way of each language: NodeJS makes `"true"` and `"false"`, while PHP makes `"1"` and `""` (an empty cell). To share an array between NodeJS and PHP, use strings.
- Invalid CSV (e.g. a stray `"` in a cell, or a quote that is not closed) is handled differently: NodeJS throws `CSV_PARSE_ERROR`, while PHP reads it in its own way without an error. To share a CSV file between NodeJS and PHP, keep it valid.

### Multiple dictionaries

Pass an array of sources, or add a dictionary later with `load()`:

```js
const lb = new LangBank(['/path/to/common.csv', '/path/to/app.csv']);
lb.load('/path/to/plugin.csv');
```

They are merged **cell by cell, and later wins**: a non-empty cell overwrites the existing word, and an empty cell never does. So you can put, for example, only the Japanese column in another file. Duplicated keys within one file are merged in the same way.

Language columns are matched case-insensitively, and `_` is treated as `-`. So a `JA` or `ja_JP` column is merged into an existing `ja` or `ja-JP` column, in the same way as above (also within one file). The column keeps the name that appeared first.

The default language is the first language column of the first loaded CSV (empty sources are skipped). It is also the initial language, unless `setLang()` has been called before. Loading more CSV files does not change the default language or the current language.

`load()` (and the constructor) reads and checks all the given sources before merging them. If any of them causes an error, nothing is merged: the words, the languages, the current language and the default language stay as they were.


## get()

```js
lb.get(key);                        // the word
lb.get(key, 'default value');       // 2nd argument is a string: the default value
lb.get(key, {name: 'Tom'});         // 2nd argument is not a string: the bind data
lb.get(key, {name: 'Tom'}, 'default value');
lb.get(key, null, 'default value');
```

When the 2nd argument is a string and the 3rd argument is `null` or `undefined`, the 2nd argument is the default value. So a wrapper function can pass its arguments as they are:

```js
function t(key, a, b){ return lb.get(key, a, b); }
t('hello', 'default value'); // same as lb.get('hello', 'default value')
```

The key must be a string or a number. In NodeJS, any other type (`undefined`, `null`, a boolean, an object, ...) throws a `TypeError`. In PHP, the key is declared as `string|int`: as usual in PHP, a `null` or an array throws a `TypeError`, while a boolean or a float is converted unless `strict_types` is declared. The same applies to `has()`, the views and `_ENV` (in a Twig template, the `TypeError` becomes a `TEMPLATE_ERROR`; use `_ENV.get(name|default(''))` for a variable that may be undefined).

The default value must be a string. Any other type (`null`, `false`, a number, ...) is treated as not given.

The 2nd argument is not checked strictly, to keep the old interpretation of the arguments when rendering:

- A string with the 3rd argument `null` or `undefined` (PHP: `null`): the default value.
- An object (NodeJS: including an array; PHP: an array or an object): the bind data.
- Anything else (a number, a boolean, a string with a non-null 3rd argument, ...): ignored. The data of `options.bind` and of the outer `get()` are still bound.

### Fallback of languages

When the word for the current language is empty or undefined, `get()` looks for it in the following order:

1. The current language.
2. The languages given by `options.fallback` for the current language.
3. The current language with its last subtag removed, repeatedly. (`zh-Hant-TW` → `zh-Hant` → `zh`)
4. The default language.

Language codes are compared case-insensitively, and `_` is treated as `-`. So `setLang('ja_JP')` finds the `ja` column.

```js
const lb = new LangBank('/path/to/list.csv', {
	"fallback": {
		"zh-HK": ["zh-TW", "zh-Hant"],
		"pt-BR": ["pt"]
	}
});
```

The languages in `options.fallback` are looked up as written: their subtags are not removed. To fall back to `zh-Hant` after `zh-Hant-TW`, write both: `["zh-Hant-TW", "zh-Hant"]`.

`resolveLang(lang)` returns the language column that `lang` is resolved to: the first column found in the steps 1 to 3 above. It does not look at the words (a column may have an empty cell for a key, and then `get()` goes on to the next language), and it does not include the step 4 (the default language), though it returns the default language if it is found in the steps 1 to 3. It returns `null` if no column is found. Without the argument (NodeJS: or with `undefined`), it resolves the current language. `null` means "no language", and returns `null`. The same applies to the views and `_ENV`, which resolve their own language without the argument.

```js
lb.resolveLang('ja_JP'); // <- "ja"
lb.resolveLang('en-GB'); // <- "en"
lb.resolveLang('xx');    // <- null
```

`setLang()` always sets the language as given (NodeJS: `null` and `undefined` become `null`, and other values become strings). It returns `true` if the language is resolved (the same as `resolveLang(lang) !== null`), and `false` otherwise. Even when it returns `false`, `get()` can return the words in the default language, if any.

`getLangList()` returns the language columns in the dictionary. A language in the list may not have the words for all the keys.

`has(key)` also looks for the word in the same order. To check whether the word is translated into the current language itself, pass `{"exact": true}`:

```js
lb.setLang('ja');
lb.has('hello');                  // <- true, even if only the default language has it
lb.has('hello', {"exact": true}); // <- true only if the "ja" column has it
```

With `{"exact": true}`, only the column of the current language (compared case-insensitively, `_` as `-`) is looked up: neither `options.fallback`, the parent languages, nor the default language. An empty cell is not a word.

### Missing keys

When no non-empty word is found in the current language or its fallback languages (including the default language), `get()` returns:

1. The default value, if given (an empty string `''` is returned as is).
2. Otherwise, the return value of `options.onMissing(key, lang)`, if given and it is a string.
3. Otherwise, **the key itself**.

The 2nd argument `lang` of `onMissing` is the language of the `get()`: the initial language, or the language given to `setLang()` or `withLang()`. It is not resolved to a language column (use `resolveLang(lang)` for it), and may be `null`.

`onMissing` may return nothing, for example to only log missing words:

```js
const lb = new LangBank('/path/to/list.csv', {
	"onMissing": function(key, lang){
		console.warn('Missing word:', key, lang); // get() returns the key
	}
});
lb.has('hello'); // <- true if a word is found
```


## withLang()

`withLang(lang)` returns a read-only view of the dictionary in the given language. It is useful when one LangBank object is shared, for example by the requests of a web server: `setLang()` changes the language for all of them, but a view does not.

```js
const lb = new LangBank('/path/to/list.csv');

app.get('/', function(req, res){
	const t = lb.withLang(req.query.lang);
	res.send( t.get('hello') );
});
```

`withLang(null)` (NodeJS: or `withLang(undefined)`) returns a view with no language: it looks up only the default language. Note that the argument of `withLang()` is required, unlike `resolveLang()`: it does not mean the current language.

A view has `get()`, `has()`, `resolveLang()`, `getLang()`, `getDefaultLang()` and `getLangList()`. `resolveLang()` without the argument resolves the language of the view. It shares the dictionary with the LangBank object, so the words loaded later with `load()` are also available. `setLang()` does not affect the views. In PHP, the view is a `tomk79\LangBankView` object. It cannot be created with `new`: use `withLang()`.

In NodeJS, a view also has the properties `lang` and `defaultLang`. They are really read-only (the view is frozen), and are there mainly for `_ENV.lang` and `_ENV.defaultLang` in Twig templates.


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

A read-only view of the LangBank object is accessible in Twig templates as `_ENV`. It is the same as the view of [`withLang()`](#withlang) in the language of the outer `get()`: it has `lang`, `defaultLang`, `get()`, `has()`, `resolveLang()`, `getLang()`, `getDefaultLang()` and `getLangList()`. Other methods (`setLang()`, `load()`, ...) are not available.

```csv
"","en"
"morning","Morning"
"goodmorning","Good {{ _ENV.get('morning') }}!"
"currentlang","Current language is {{ _ENV.lang }}."
```

`_ENV.get()` inherits the bind data of the outer `get()`. The data given to `_ENV.get()` itself has priority.

```csv
"","en"
"greeting","Hello, {{ name }}"
"welcome","{{ _ENV.get('greeting') }} Welcome!"
```

```js
lb.get('welcome', {"name": "Tom"}); // <- "Hello, Tom Welcome!"
```

A word that refers to itself, directly or through other words (`a` → `b` → `a`), throws `CIRCULAR_REFERENCE`. A key that appears again while it is being rendered is always treated as circular, even with a different default value or bind data.

### Writing `{{` literally

Use the `verbatim` tag (it works in both NodeJS and PHP):

```csv
"","en"
"example","{% verbatim %}Write {{ name }} to insert a name.{% endverbatim %}"
```

Or disable Twig entirely with `"twig": false`.

### HTML escaping

By default, words are **not** HTML-escaped: LangBank returns plain strings, and escaping is the job of the output side (your template engine, etc.). To escape the bound values in the Twig templates, set `"autoescape": "html"` (or `true`). The other strategies `"js"`, `"css"`, `"url"` and `"html_attr"` are also available.

The words themselves are not escaped, so you can write HTML tags in them. The result of `_ENV.get()` is treated in the same way: it is already escaped by the inner `get()`, and is not escaped again. The default value of `_ENV.get()` is also a part of the template, and is not escaped either. Only when neither a word nor a default value is found, the returned key (or the return value of `onMissing`) is escaped as a normal value, because the key may come from bind data (`_ENV.get(name)`).

```csv
"","en"
"greeting","Hello, <b>{{ name }}</b>"
"welcome","{{ _ENV.get('greeting') }} Welcome!"
```

```js
const lb = new LangBank('/path/to/list.csv', {"autoescape": "html"});
lb.get('welcome', {"name": "<Tom>"}); // <- "Hello, <b>&lt;Tom&gt;</b> Welcome!"
```

With autoescape, output the result of `_ENV.get()` as it is. If you apply filters to it or concatenate it with `~`, the result may be escaped again, or (in NodeJS) the filter may not work.

### Security

Words and default values are evaluated as Twig templates. Do not put untrusted strings into them:

- Do not load CSV files from untrusted sources, or set `"twig": false` if you have to.
- Do not pass untrusted strings (e.g. user input) as the default value. Pass them as bind data instead: the values of bind data are not evaluated.

```js
lb.get('key', userInput);                           // NG
lb.get('key', {"input": userInput}, '{{ input }}');  // OK
```

The same applies to `_ENV.get()` in the words: do not pass bind data as its default value. It would be evaluated as a template, and would not be escaped even with autoescape.

```csv
"","en"
"ng","{{ _ENV.get('key', input) }}"
"ok","{{ _ENV.get('key', '{{ input }}') }}"
```


## Options

| Option | Default | Description |
|---|---|---|
| `bind` | `{}` | Data bound to all Twig templates (an object; in PHP, an array or an object). |
| `autoescape` | `false` | Escaping strategy of Twig: `false`, `true` (same as `"html"`), `"html"`, `"js"`, `"css"`, `"url"` or `"html_attr"`. |
| `twig` | `true` | `false` to return words without evaluating Twig. |
| `onMissing` | (none) | `function(key, lang)` that returns the string when no word is found (see [Missing keys](#missing-keys)). If it returns a non-string, the key is used. |
| `fallback` | `{}` | Fallback languages for each language: `{"lang": ["fallback", ...]}`. A single language can be written as a string. |

In PHP, pass the options as an associative array, and `onMissing` as a callable.

The options are checked in the constructor: an unknown option name (e.g. a typo like `onmissing`) or a value of a wrong type throws `INVALID_OPTION`. An option whose value is `null` or `undefined` is treated as not given. The options as a whole (of the constructor and of `has()`) may be omitted or `null` (NodeJS: or `undefined`). Otherwise, they must be an object other than an array (NodeJS) / an array (PHP), and any other value throws a `TypeError`. (NodeJS: a function as the 2nd argument of the constructor is the deprecated callback.)

The options are copied in the constructor: adding, removing or replacing the items of the given options (and of `bind` and `fallback`) after that does not affect the LangBank object. The copy is shallow, though: the objects nested in `bind` are shared, and modifying them does affect it (in PHP, nested arrays are copied as values, as usual).

In PHP, `bind` is read in the same way as the bind data of `get()`: the public properties of an object, or the items of a `Traversable`. A `Traversable` like a `Generator` is read (and consumed) in the constructor.


## API

| Method | Description |
|---|---|
| `new LangBank([source][, options])` | Loads the dictionary. Throws on errors. (NodeJS: `new` is required. The deprecated 3rd argument `callback` is called asynchronously after the initialization.) |
| `setLang(lang)` | Sets the current language. Returns `false` if the language is not resolved (see [Fallback of languages](#fallback-of-languages)). |
| `getLang()` | Returns the current language: initially the default language (or `null` for an empty dictionary), and after `setLang()`, the value stored by it. |
| `resolveLang([lang])` | Returns the language column that the language (default: the current language) is resolved to, or `null`. |
| `getDefaultLang()` | Returns the default language. |
| `getLangList()` | Returns the languages in the dictionary. |
| `get(key[, bindData][, defaultValue])` | Returns the word in the current language. |
| `has(key[, options])` | Returns `true` if a word for the key is found in the current language (including fallback, unless `{"exact": true}`). |
| `withLang(lang)` | Returns a read-only view in the given language (see [withLang()](#withlang)). `null` for no language. |
| `getList()` | Returns a copy of the whole dictionary: `{key: {lang: word}}`. Every key has all the languages of `getLangList()`, and a missing word is `''`. The words are not rendered, and fallback is not applied. In PHP, a numeric key like `"123"` becomes an integer key, as PHP arrays do. In NodeJS, the order of the properties may differ from `getLangList()` (e.g. for numeric language names): iterate `getLangList()` if the order matters. |
| `load(source)` | Loads and merges another dictionary. Returns the LangBank object. On errors, nothing is merged. |

The properties `lang` and `defaultLang` are still readable for compatibility, but use `getLang()` and `getDefaultLang()` instead. Assigning to them is not supported: use `setLang()` to change the language. (They are actually writable for compatibility: in NodeJS, they are `readonly` only in the TypeScript definition, and in PHP, they are public properties.) Other properties are internal.

### Extending LangBank

In NodeJS, the methods are defined for each object (so they can be called detached, like `const get = lb.get;`). Therefore, overriding the methods in a subclass is not supported: the overriding methods are not called. Wrap the LangBank object instead.

In PHP, `tomk79\LangBank` can be extended, but the views (`withLang()`) and `_ENV` use the internals of LangBank directly: they do not call the overriding methods like `get()`.


## Errors

Errors are thrown as `LangBank.LangBankError` (NodeJS) / `tomk79\LangBankException` (PHP). The error code is `error.code` (NodeJS) / `$e->getErrorCode()` (PHP).

A wrong type of the following arguments throws a `TypeError` instead:

- The key of `get()` and `has()` (e.g. `null`). See [get()](#get).
- The options of the constructor and of `has()` as a whole, if they are neither omitted nor `null` (NodeJS: or `undefined`), and are not an object other than an array (NodeJS) / an array (PHP). See [Options](#options). An invalid option in them throws `INVALID_OPTION`.
- PHP: the other arguments with type declarations (e.g. an array given to `setLang()`).

Other arguments follow their own rules: an invalid source throws `INVALID_SOURCE`, and the 2nd and 3rd arguments of `get()` are interpreted as described in [get()](#get) (a value of another type is ignored).

| Code | When |
|---|---|
| `FILE_NOT_FOUND` | The file of the given path does not exist. |
| `FILE_READ_ERROR` | Failed to read the file. |
| `INVALID_SOURCE` | Unsupported type of source, or an invalid row or cell in a CSV array. |
| `INVALID_CSV` | The CSV header has no language columns. |
| `CSV_PARSE_ERROR` | Failed to parse the CSV text (NodeJS only). |
| `TEMPLATE_ERROR` | Failed to render the Twig template in `get()`. The original error is in `error.cause` (NodeJS) / the chain of `$e->getPrevious()` (PHP: Twig may wrap it in its own error). |
| `CIRCULAR_REFERENCE` | A word refers to itself through `_ENV.get()`. |
| `INVALID_OPTION` | An unknown option, or an invalid value of an option (also of `has()`). Options of a wrong type as a whole (e.g. a string) throw a `TypeError` instead. |

The codes are also available as constants: `LangBank.LangBankError.FILE_NOT_FOUND` (NodeJS) / `tomk79\LangBankException::FILE_NOT_FOUND` (PHP).

```js
try{
	lb.load(path);
}catch(e){
	if( e.code === LangBank.LangBankError.FILE_NOT_FOUND ){ /* ... */ }
}
```

A LangBank error in `_ENV.get()` is thrown as is from the outer `get()`. For example, a Twig error in the inner word is a `TEMPLATE_ERROR` of the inner key. Other errors in a template, including a `TypeError` of `_ENV.get()` and an error thrown by `onMissing`, are wrapped in a `TEMPLATE_ERROR` of the outer key (the original error is in `error.cause` / the chain of `$e->getPrevious()`).

Even when a (deprecated) callback is given, errors are thrown from the constructor synchronously.


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
| `_ENV` in Twig templates is a read-only view. `_ENV.setLang()`, `_ENV.load()`, `_ENV.options`, etc. are not available. | Call them outside the templates. |
| `_ENV.get()` inherits the bind data of the outer `get()`. | Pass the data to `_ENV.get()` explicitly to override it. |
| Language columns that differ only in case or `_`/`-` (e.g. `ja` and `JA`) are merged into one column. | — |
| NodeJS: files other than `libs/LangBank.js` cannot be required directly (`exports` in package.json). | Require `langbank`. |
| An unknown option or an invalid value of an option throws `INVALID_OPTION`. Options of a wrong type as a whole (NodeJS: other than an object, an array included; PHP: other than an array) throw a `TypeError`. | Fix the options. |
| PHP: the methods have type declarations. A subclass that overrides them must have compatible signatures. | Update the signatures of the subclass. |
| PHP: with `autoescape`, the result of `_ENV.get()` is not escaped again. | — |
| NodeJS: a key of `get()` or `has()` that is not a string or a number (e.g. `undefined`, `null`) throws a `TypeError`. In Twig templates, `_ENV.get()` with an undefined variable throws a `TEMPLATE_ERROR` (also in PHP). | Pass a string. In templates, use `_ENV.get(name\|default(''))`. |

The callback style constructor still works, and is still called asynchronously. It is deprecated.


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
- `has()`, `getLangList()`, `getDefaultLang()` を追加。 `setLang()` は、辞書にない言語に対して `false` を返すようになった。
- NodeJS版: 同期で初期化するようになった。 TypeScript の型定義と ESM に対応。
- Twig テンプレートの `_ENV` を、読み取り専用のオブジェクトに変更した。 `_ENV.get()` は外側の `get()` のバインドデータを引き継ぐ。
- 訳文の循環参照を検出し、 `CIRCULAR_REFERENCE` を投げるようになった。 (PHP版で Fatal error になっていた)
- 大文字・小文字や `_`/`-` だけが違う言語名の列を、1 つの列にまとめるようになった。
- `onMissing` が文字列以外を返した場合は、キーを返すようにした。
- npm と Composer のパッケージから、テストなどの不要なファイルを除いた。
- `withLang()` を追加。言語を固定した、読み取り専用のビューを返す。ビューと `_ENV` には `getLangList()` と `resolveLang()` もある。
- `has()` に `{"exact": true}` オプションを追加。 Twig テンプレートの中の `_ENV.has()` にも渡せる。
- `resolveLang()` を追加。言語を、辞書にある最初の候補の列名に解決する。
- コンストラクタの第 1 引数を省略できるようにした。
- `load()` は、すべての読み込み元を検証してからマージするようになった。エラーの場合は辞書を変えない。
- 一度 `setLang()` を呼んだ後は、 `load()` で初期言語を設定しないようにした。
- NodeJS版: `setLang()` は、 `null`, `undefined` を `null` に、それ以外の値を文字列にして保存するようになった。
- オプションを検証し、未知のオプションや不正な値に対して `INVALID_OPTION` を投げるようになった。オプション全体が `null` (NodeJS版は `undefined` も) でも、配列以外のオブジェクト (PHP版: 配列) でもなければ `TypeError` を投げる。 `autoescape` に指定できる値を `false`, `true`, `"html"`, `"js"`, `"css"`, `"url"`, `"html_attr"` に限定した。
- エラーコードの定数を追加 (`LangBank.LangBankError.FILE_NOT_FOUND`, `tomk79\LangBankException::FILE_NOT_FOUND` など)。
- `get()` の第 2 引数が文字列で、第 3 引数が `null` (または `undefined`) の場合も、第 2 引数をデフォルト値として扱うようになった。 (ラッパー関数から引数をそのまま渡せる)
- 読み込み元のリストの中の `null`, `''`, `[]` を読み飛ばすようになった。
- `autoescape` が有効な場合に、 `_ENV.get()` の結果が二重にエスケープされる不具合を修正。
- NodeJS版: コンストラクタのコールバックを非推奨にした。
- オプションをコンストラクタでコピーするようになった。 (浅いコピー。PHP版の `bind` は、 `get()` のバインドデータと同じように列挙して読む)
- NodeJS版: `new` を付けずにコンストラクタを呼ぶと、 `TypeError` を投げるようになった。 (グローバル変数を書き換えていた)
- PHP版: メソッドに型宣言を付けた。
- NodeJS版: `get()`, `has()` のキーが文字列・数値以外の場合に、 `TypeError` を投げるようになった。 Twig テンプレートの中の `_ENV.get()`, `_ENV.has()` も、両言語でキーの型を検証する。
- `getList()` は、すべてのキーにすべての言語を持たせ、ない訳文を `''` で返すようになった。
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
