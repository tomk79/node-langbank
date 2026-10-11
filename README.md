# langbank

A simple multilingual dictionary library for Node.js, browsers and PHP.
Write your words in a CSV file, and get them in the current language. Words can contain placeholders like `{{ name }}`.

langbank has no dependencies, and works in the same way in NodeJS and PHP.

## Install

NodeJS:

```
$ npm install --save langbank;
```

PHP:

```
$ composer require tomk79/langbank;
```

Requirements: Node.js >= 14 / PHP >= 8.1 (with mbstring). For browsers, see [Browsers](#browsers).


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

The constructor loads the dictionary synchronously, so you can use it right away.

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
| A string without line breaks | A file path. Throws `FILE_NOT_FOUND` if the file does not exist (and always in browsers). |
| A 2-dimensional array | Parsed CSV rows. Each row must be an array (or `null`), and each cell must be a scalar value (or `null`). |
| An array of the above (strings and/or 2-dimensional arrays) | Multiple sources, merged in order. `null`, `undefined`, `''` and `[]` in the array are skipped. A 2-dimensional array in the list may also have `null` rows. |

```js
new LangBank('/path/to/list.csv');
new LangBank('"","en","ja"\n"hello","Hello","こんにちは"');
new LangBank([["", "en", "ja"], ["hello", "Hello", "こんにちは"]]);
new LangBank(['/path/to/common.csv', '/path/to/app.csv']);
new LangBank(['/path/to/common.csv', isDev ? '/path/to/dev.csv' : null]);
new LangBank(null, {"fallback": {"pt-BR": "pt"}}); // an empty dictionary with options
```

- A UTF-8 BOM is accepted. Rows may have different numbers of columns. Empty rows are skipped.
- Line breaks may be LF or CRLF. CR only line breaks are accepted when the text has no LF at all: then every CR is converted to LF beforehand, including the CRs in quoted cells. Otherwise, line breaks in a quoted cell are kept as they are.
- A backslash is not an escape character (RFC 4180). Write `""` for a double quote in a quoted cell.
- Files must be in UTF-8. In PHP, Shift_JIS and EUC-JP files are also detected and converted.
- In a 2-dimensional array, a boolean cell is converted to a string in the way of each language: NodeJS makes `"true"` and `"false"`, while PHP makes `"1"` and `""` (an empty cell). To share an array between NodeJS and PHP, use strings.

### Invalid CSV

Invalid CSV does not throw an error. NodeJS and PHP read it in the same way, with the rules of `fgetcsv()` of PHP 8.3 or later (LangBank has its own implementation of them, so the result does not depend on the version or the locale of PHP):

- A cell that starts with `"` is a quoted cell. Whitespace (space, tab, CR, LF, vertical tab and form feed) before the `"` is removed. The cell ends at the next `"` that is not followed by another `"`. The characters after the closing `"`, up to the next `,` or line break, are added as they are: `"ab"cd` is read as `abcd`.
- A `"` in a cell that does not start with `"` is kept as it is: `ab"cd` is read as `ab"cd`.
- A quoted cell that is not closed continues to the end of the text.

To avoid surprises, keep your CSV valid. If you need another parser, parse the CSV yourself and pass the 2-dimensional array.

### Multiple dictionaries

Pass an array of sources, or add a dictionary later with `load()`:

```js
const lb = new LangBank(['/path/to/common.csv', '/path/to/app.csv']);
lb.load('/path/to/plugin.csv');
```

They are merged **cell by cell, and later wins**: a non-empty cell overwrites the existing word, and an empty cell never does. So you can put, for example, only the Japanese column in another file. Duplicated keys within one file are merged in the same way.

Language columns are matched case-insensitively, and `_` is treated as `-`. So a `JA` or `ja_JP` column is merged into an existing `ja` or `ja-JP` column, in the same way as above (also within one file). The column keeps the name that appeared first.

The default language is the first language column of the first loaded CSV (empty sources are skipped). It is also the initial language, unless `setLang()` has been called before. Loading more CSV files does not change the default language or the current language.

`load()` (and the constructor) reads and checks all the given sources before merging them, including the [reserved syntax](#reserved-syntax) in the words. If any of them causes an error, nothing is merged: the words, the languages, the current language and the default language stay as they were.


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

The key must be a string or a number. In NodeJS, any other type (`undefined`, `null`, a boolean, an object, ...) throws a `TypeError`. In PHP, the key is declared as `string|int`: as usual in PHP, a `null` or an array throws a `TypeError`, while a boolean or a float is converted unless `strict_types` is declared. The same applies to `has()` and the views.

The default value must be a string. Any other type (`null`, `false`, a number, ...) is treated as not given.

The 2nd argument is not checked strictly:

- A string with the 3rd argument `null` or `undefined` (PHP: `null`): the default value.
- An object (NodeJS: including an array; PHP: an array or an object): the bind data.
- Anything else (a number, a boolean, a string with a non-null 3rd argument, ...): ignored. The data of `options.bind` is still bound.

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

`resolveLang(lang)` returns the language column that `lang` is resolved to: the first column found in the steps 1 to 3 above. It does not look at the words (a column may have an empty cell for a key, and then `get()` goes on to the next language), and it does not include the step 4 (the default language), though it returns the default language if it is found in the steps 1 to 3. It returns `null` if no column is found. Without the argument (NodeJS: or with `undefined`), it resolves the current language. `null` means "no language", and returns `null`. The same applies to the views, which resolve their own language without the argument.

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

The placeholders in the default value are replaced in the same way as in the words. The returned key and the return value of `onMissing` are returned as they are.

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

In NodeJS, a view also has the properties `lang` and `defaultLang`. They are really read-only (the view is frozen).


## Placeholders

A word can contain placeholders like `{{ name }}`. They are replaced with the values of the bind data.

list.csv:

```csv
"","en"
"goodmorning","Good {{ sample }}!"
```

Bind data for every `get()` with `options.bind`, or for one `get()` with its 2nd argument. The data of `get()` has priority:

```js
const lb = new LangBank('/path/to/list.csv', {
	"bind": {
		"sample": "Morning"
	}
});
lb.get('goodmorning'); // <- "Good Morning!"
lb.get('goodmorning', {"sample": "Evening"}); // <- "Good Evening!"
```

The default value can also contain placeholders:

```js
lb.get('undefinedKey', {"name": "Tom"}, 'Hello, {{ name }}!'); // <- "Hello, Tom!"
```

- A placeholder is `{{`, a name and `}}`. The name consists of ASCII letters, digits and `_`, and does not start with a digit. Spaces, tabs and line breaks around the name are allowed: `{{name}}` is the same as `{{ name }}`.
- The placeholders are replaced in a single pass. The values are inserted as they are, and are **never processed again**: a value `{{ x }}` is output as `{{ x }}`.
- A variable that is not bound, or is bound to `null` (NodeJS: or `undefined`), becomes an empty string `''`.
- A string is inserted as it is. A number is converted to a string (NodeJS: `String()`, PHP: `(string)`). Integers (PHP: of the type `int`; NodeJS: below `2 ** 53`) are written in the same way in both languages, but other numbers may not (e.g. `0.1 + 0.2`, or a large float like `1e20`): pass a string to get the same result. `true` becomes `'1'`, and `false` becomes `''`. Any other type (an array, an object, ...) throws `TEMPLATE_ERROR`.
- In NodeJS, only the own enumerable properties of the bind data are looked up (also for `options.bind`): `{{ constructor }}` does not find `Object.prototype.constructor`. In PHP, the bind data is read as the items of an array, the public properties of an object, or the items of a `Traversable`.
- `getList()` returns the words as they are, without replacing the placeholders.

To return all the words (and the default values) as they are, without replacing or checking the placeholders, set `"template": false`.

### Reserved syntax

`{{`, `{%` and `{#` are reserved. A word or a default value that contains one of them that does not start a valid placeholder throws `TEMPLATE_ERROR`. For example:

```csv
"","en"
"ng1","{% if name %}Hello{% endif %}"
"ng2","{# comment #}"
"ng3","{{ user.name }}"
"ng4","{{ name|upper }}"
"ng5","Hello, {{ name"
```

- The words in CSV are checked when they are loaded (in the constructor and in `load()`). So an invalid word is found when the dictionary is loaded, without displaying it. As with other errors of `load()`, nothing is merged.
- A default value is checked when `get()` is called.
- The 1st column (the keys) and the header are not checked.
- `}}` without `{{`, and a single `{`, are normal text.

This finds the words written for the Twig templates of v1, and keeps the syntax for future versions.

### Writing `{{` literally

Bind it as a value. The values are not processed:

```csv
"","en"
"example","Write {{ placeholder }} to insert a name."
```

```js
lb.get('example', {"placeholder": "{{ name }}"}); // <- "Write {{ name }} to insert a name."
```

Or set `"template": false` to return all the words as they are.

### HTML escaping

LangBank does not escape anything: it returns the words and the values as they are. Escape them on the output side:

- If the words are plain text, escape the whole result (or insert it as text, e.g. with `textContent`).
- If the words contain HTML tags (e.g. `Hello, <b>{{ name }}</b>`), escaping the whole result also escapes the tags. Escape the values before binding them instead:

```js
lb.get('greeting', {"name": escapeHtml(userName)}); // escapeHtml() is your function
```

This is safe, because the values are not processed after they are inserted.

### Security

- The values of bind data are never processed. Pass untrusted strings (e.g. user input) as bind data, and escape them for the output (see above).
- Do not pass untrusted strings as the default value. Its placeholders would be replaced (e.g. `{{ token }}` would output the value of `options.bind`), and the reserved syntax would throw `TEMPLATE_ERROR`. Pass them as bind data instead:

```js
lb.get('key', userInput);                           // NG
lb.get('key', {"input": userInput}, '{{ input }}');  // OK
```

- The words are never executed as code. Still, a CSV file from an untrusted source can contain any HTML, and placeholders for any bound value. Do not load it without checking.


## Browsers

LangBank does not refer to the Node.js built-in modules and globals (`fs`, `path`, `stream`, `Buffer`, `process`, ...) when it is loaded. So it can be bundled for browsers and WebViews without polyfills. The bundle is about 10 KB minified, and about 4 KB gzipped.

The code to read files is excluded by the `browser` field of package.json, which most bundlers respect for browser builds (e.g. Vite, webpack, esbuild with `--platform=browser`). In browsers, pass CSV text or a 2-dimensional array. A file path throws `FILE_NOT_FOUND`.

```js
import LangBank from 'langbank';
import csv from './messages.csv?raw'; // Vite: import a file as a string

const lb = new LangBank(csv);
```

Note that a string without line breaks is treated as a file path. A CSV text that has only the header row must end with a line break.

The tests bundle LangBank with esbuild (without polyfills), and run it in Chromium and WebKit (with Playwright). The code of LangBank is written in ES5.


## Options

| Option | Default | Description |
|---|---|---|
| `bind` | `{}` | Data bound to the placeholders of all the words (an object; in PHP, an array or an object). |
| `template` | `true` | `false` to return the words and the default values as they are, without replacing or checking the placeholders. |
| `onMissing` | (none) | `function(key, lang)` that returns the string when no word is found (see [Missing keys](#missing-keys)). If it returns a non-string, the key is used. |
| `fallback` | `{}` | Fallback languages for each language: `{"lang": ["fallback", ...]}`. A single language can be written as a string. |

In PHP, pass the options as an associative array, and `onMissing` as a callable.

The options are checked in the constructor: an unknown option name (e.g. a typo like `onmissing`, or `twig` and `autoescape` of v1) or a value of a wrong type throws `INVALID_OPTION`. An option whose value is `null` or `undefined` is treated as not given. The options as a whole (of the constructor and of `has()`) may be omitted or `null` (NodeJS: or `undefined`). Otherwise, they must be an object other than an array (NodeJS) / an array (PHP), and any other value (NodeJS: including a function) throws a `TypeError`.

The options are copied in the constructor: adding, removing or replacing the items of the given options (and of `bind` and `fallback`) after that does not affect the LangBank object. The copy is shallow, though: the objects nested in `bind` are shared, and modifying them does affect it (in PHP, nested arrays are copied as values, as usual).

In PHP, `bind` is read in the same way as the bind data of `get()`: the public properties of an object, or the items of a `Traversable`. A `Traversable` like a `Generator` is read (and consumed) in the constructor.


## API

| Method | Description |
|---|---|
| `new LangBank([source][, options])` | Loads the dictionary synchronously. Throws on errors. (NodeJS: `new` is required. A 3rd argument other than `undefined`, like the callback of v1, throws a `TypeError`.) |
| `setLang(lang)` | Sets the current language. Returns `false` if the language is not resolved (see [Fallback of languages](#fallback-of-languages)). |
| `getLang()` | Returns the current language: initially the default language (or `null` for an empty dictionary), and after `setLang()`, the value stored by it. |
| `resolveLang([lang])` | Returns the language column that the language (default: the current language) is resolved to, or `null`. |
| `getDefaultLang()` | Returns the default language. |
| `getLangList()` | Returns the languages in the dictionary. |
| `get(key[, bindData][, defaultValue])` | Returns the word in the current language. |
| `has(key[, options])` | Returns `true` if a word for the key is found in the current language (including fallback, unless `{"exact": true}`). |
| `withLang(lang)` | Returns a read-only view in the given language (see [withLang()](#withlang)). `null` for no language. |
| `getList()` | Returns a copy of the whole dictionary: `{key: {lang: word}}`. Every key has all the languages of `getLangList()`, and a missing word is `''`. The placeholders are not replaced, and fallback is not applied. In PHP, a numeric key like `"123"` becomes an integer key, as PHP arrays do. In NodeJS, the order of the properties may differ from `getLangList()` (e.g. for numeric language names): iterate `getLangList()` if the order matters. |
| `load(source)` | Loads and merges another dictionary. Returns the LangBank object. On errors, nothing is merged. |

The properties `lang` and `defaultLang` are still readable for compatibility, but use `getLang()` and `getDefaultLang()` instead. Assigning to them is not supported: use `setLang()` to change the language. (They are actually writable for compatibility: in NodeJS, they are `readonly` only in the TypeScript definition, and in PHP, they are public properties.) Other properties are internal.

### Extending LangBank

In NodeJS, the methods are defined for each object (so they can be called detached, like `const get = lb.get;`). Therefore, overriding the methods in a subclass is not supported: the overriding methods are not called. Wrap the LangBank object instead.

In PHP, `tomk79\LangBank` can be extended, but the views (`withLang()`) use the internals of LangBank directly: they do not call the overriding methods like `get()`.


## Errors

Errors are thrown as `LangBank.LangBankError` (NodeJS) / `tomk79\LangBankException` (PHP). The error code is `error.code` (NodeJS) / `$e->getErrorCode()` (PHP).

A wrong type of the following arguments throws a `TypeError` instead:

- The key of `get()` and `has()` (e.g. `null`). See [get()](#get).
- The options of the constructor and of `has()` as a whole, if they are neither omitted nor `null` (NodeJS: or `undefined`), and are not an object other than an array (NodeJS) / an array (PHP). See [Options](#options). An invalid option in them throws `INVALID_OPTION`.
- NodeJS: a 3rd argument of the constructor, other than `undefined`.
- PHP: the other arguments with type declarations (e.g. an array given to `setLang()`).

Other arguments follow their own rules: an invalid source throws `INVALID_SOURCE`, and the 2nd and 3rd arguments of `get()` are interpreted as described in [get()](#get) (a value of another type is ignored).

| Code | When |
|---|---|
| `FILE_NOT_FOUND` | The file of the given path does not exist, or the file system is not available (browsers). |
| `FILE_READ_ERROR` | Failed to read the file. |
| `INVALID_SOURCE` | Unsupported type of source, or an invalid row or cell in a CSV array. |
| `INVALID_CSV` | The CSV header has no language columns. |
| `TEMPLATE_ERROR` | A word (when loaded) or a default value (in `get()`) has the [reserved syntax](#reserved-syntax), or a bound value has an unsupported type (in `get()`). The message has the key and the language. |
| `INVALID_OPTION` | An unknown option, or an invalid value of an option (also of `has()`). Options of a wrong type as a whole (e.g. a string) throw a `TypeError` instead. |

The codes are also available as constants: `LangBank.LangBankError.FILE_NOT_FOUND` (NodeJS) / `tomk79\LangBankException::FILE_NOT_FOUND` (PHP).

```js
try{
	lb.load(path);
}catch(e){
	if( e.code === LangBank.LangBankError.FILE_NOT_FOUND ){ /* ... */ }
}
```


## Migration from v1

v2.0.0 replaces Twig with simple placeholders, and removes the dependencies. To migrate from v0.3, read "Migration from v0.3" in [the README of v1.0.x](https://github.com/tomk79/node-langbank/blob/1.0.x/README.md#migration-from-v03) first.

| Change | What to do |
|---|---|
| Twig is no longer used. Only the placeholders `{{ name }}` are replaced. The other Twig syntax (`{% ... %}`, `{# ... #}`, expressions like `{{ user.name }}`, filters, ...) throws `TEMPLATE_ERROR` when the CSV is loaded. | Rewrite such words. To keep using Twig, set `"template": false` and render the words with Twig yourself (e.g. `Twig.twig({data: lb.get(key)}).render(data)`). |
| `_ENV` is removed (`_ENV.get()`, `_ENV.lang`, ...), and so is `CIRCULAR_REFERENCE`. | Call `get()` outside and bind the result: `lb.get('welcome', {"greeting": lb.get('greeting', {"name": name})})`. |
| `{% verbatim %}` is not available. | Bind `{{` as a value (see [Writing `{{` literally](#writing--literally)). |
| The option `autoescape` is removed (it throws `INVALID_OPTION`). | Escape the values before binding them, or escape the result (see [HTML escaping](#html-escaping)). |
| The option `twig` is renamed to `template` (`twig` throws `INVALID_OPTION`). | `"template": false` |
| A bound value of an array or an object throws `TEMPLATE_ERROR`. | Bind a string. |
| CSV is read by LangBank's own parser, with the same rules in NodeJS and PHP (see [Invalid CSV](#invalid-csv)). NodeJS: invalid CSV no longer throws, and `CSV_PARSE_ERROR` is removed. PHP: `fgetcsv()` is no longer used, so the result of invalid CSV that ends with an unclosed quote may differ on PHP 8.2 or earlier. | Keep your CSV valid, or parse it yourself and pass the array. |
| NodeJS: the callback of the constructor is removed. A 3rd argument (other than `undefined`), or a function as the 2nd argument, throws a `TypeError`. | Use the LangBank object right after the constructor. |
| The error codes `CSV_PARSE_ERROR` and `CIRCULAR_REFERENCE` and their constants are removed. | Remove them from your code. |
| `twig` and `csv` (npm) / `twig/twig` (Composer) are no longer installed with LangBank. | Install them yourself, if your code uses them. |


## Support

v2.x is the current version. v1.0.x receives security fixes only.


## Change Log

### langbank v2.0.0 (リリース前)

- 破壊的な変更を含みます。 "Migration from v1" を参照してください。
- Twig と csv への依存をなくした。依存するパッケージはない。
- テンプレートは、プレースホルダー `{{ name }}` の置き換えだけになった。NodeJS版・PHP版ともに自前で実装し、同じ結果を返す。差し込んだ値は評価し直さない。値がない変数は空文字になる。
- `{{`, `{%`, `{#` のうち、正しいプレースホルダーにならないものに対して `TEMPLATE_ERROR` を投げるようになった。CSV の訳文は読み込み時に、デフォルト値は `get()` のときに検査する。
- Twig テンプレートの `_ENV`、 `autoescape` オプション、エラーコード `CIRCULAR_REFERENCE` を廃止した。
- `twig` オプションを `template` に改名した。
- CSV のパーサーを自前で実装した。NodeJS版・PHP版ともに、PHP 8.3 以降の `fgetcsv()` と同じ規則で読む (PHP のバージョンやロケールによらない)。NodeJS版は、不正な CSV でもエラーにしなくなった。エラーコード `CSV_PARSE_ERROR` を廃止した。
- NodeJS版: 読み込み時に Node.js の組み込みモジュールやグローバル (`fs`, `Buffer` など) を参照しないようにした。ポリフィルなしでブラウザ向けにバンドルできる。
- NodeJS版: 非推奨だったコンストラクタのコールバックを廃止した。
- v1.0.x には、セキュリティ修正だけを続ける。


### langbank v1.0.0 (2026-10-10)

- 破壊的な変更を含みます。 "Migration from v0.3" を参照してください。
- 未定義のキーに対して、 `---` ではなくキーそのものを返すようになった。 `onMissing` オプションで変更できる。
- 読み込みや Twig の評価に失敗したとき、エラーコードを持つ例外 (NodeJS版: `LangBankError`, PHP版: `tomk79\LangBankException`) を投げるようになった。エラーコードの定数もある (`LangBank.LangBankError.FILE_NOT_FOUND`, `tomk79\LangBankException::FILE_NOT_FOUND` など)。
- 改行を含まない文字列をファイルパスとして扱い、ファイルがなければ例外を投げるようになった。
- PHP版: CSV 文字列とパース済みの配列を受け取れるようになった。
- 複数の CSV をマージできるようになった。 `load()` を追加。1 つの CSV の中で重複したキーも、セルごとにマージする。
- 言語のフォールバックを拡張した (`en-US` → `en` など)。 `fallback` オプションを追加。
- `autoescape`, `twig` オプションを追加。HTML エスケープの既定を、NodeJS版・PHP版ともに無効に統一した。
- `has()`, `getLangList()`, `getDefaultLang()`, `resolveLang()` を追加。 `setLang()` は、辞書にない言語に対して `false` を返すようになった。
- `withLang()` を追加。言語を固定した、読み取り専用のビューを返す。
- NodeJS版: 同期で初期化するようになった。 TypeScript の型定義と ESM に対応。
- NodeJS版: コンストラクタのコールバックを非推奨にした。
- Twig テンプレートの `_ENV` を、読み取り専用のオブジェクトに変更した。 `_ENV.get()` は外側の `get()` のバインドデータを引き継ぐ。
- 訳文の循環参照を検出し、 `CIRCULAR_REFERENCE` を投げるようになった。 (PHP版で Fatal error になっていた)
- 大文字・小文字や `_`/`-` だけが違う言語名の列を、1 つの列にまとめるようになった。
- オプションを検証し、未知のオプションや不正な値に対して `INVALID_OPTION` を、オプション全体の型の誤りに対して `TypeError` を投げるようになった。
- コンストラクタの第 1 引数を省略できるようにした。
- `get()` の第 2 引数が文字列で、第 3 引数が `null` (または `undefined`) の場合も、第 2 引数をデフォルト値として扱うようになった。 (ラッパー関数から引数をそのまま渡せる)
- `getList()` は、すべてのキーにすべての言語を持たせ、ない訳文を `''` で返すようになった。NodeJS版は辞書のコピーを返す。
- NodeJS版: `setLang()` は、 `null`, `undefined` を `null` に、それ以外の値を文字列にして保存するようになった。
- NodeJS版: `new` を付けずにコンストラクタを呼ぶと、 `TypeError` を投げるようになった。 (グローバル変数を書き換えていた)
- NodeJS版: `get()`, `has()` のキーが文字列・数値以外の場合に、 `TypeError` を投げるようになった。 Twig テンプレートの中の `_ENV.get()`, `_ENV.has()` も、両言語でキーの型を検証する。
- NodeJS版: オプションをコンストラクタでコピーするようになった。 (浅いコピー)
- NodeJS版: `libs/LangBank.js` 以外のファイルを直接 `require` できなくなった (package.json の `exports`)。
- PHP版: メソッドに型宣言を付けた。
- NodeJS版: `get()` に渡したバインドデータが、後の呼び出しに残る不具合を修正。
- NodeJS版: コールバックを省略して options を渡すと、例外が発生する不具合を修正。
- PHP版: `get()` のバインドデータに `null` を渡すと Warning が発生する不具合を修正。
- PHP版: `_ENV.get()` の結果が、二重に HTML エスケープされる不具合を修正。
- PHP版: Shift_JIS のファイルが文字化けする不具合を修正。CR だけで改行された CSV を読めるようになった。 `tomk79/filesystem` への依存を削除。
- npm と Composer のパッケージから、テストなどの不要なファイルを除いた。
- サポートする環境を、 Node.js >= 14, Twig.js ^1.17, PHP >= 8.1 (mbstring 拡張が必要), Twig ^3.27 に変更。 (PHP 8.0 以前で使える Twig には、すべてセキュリティ勧告が出ているため)

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
