/**
 * langbank.js: CSV parser
 *
 * PHP版 (fgetcsv($fp, 0, ',', '"', '')) と同じ結果を返すように、
 * php-src (ext/standard/file.c) の php_fgetcsv() を移植したもの。
 * 不正な CSV でもエラーにしない。
 */

var DELIMITER = ',';
var ENCLOSURE = '"';

/**
 * C の isspace() (C ロケール)
 */
function isSpace(chr){
	return chr === ' ' || chr === '\t' || chr === '\n' || chr === '\r' || chr === '\v' || chr === '\f';
}

/**
 * 末尾の改行 (\r\n, \n, \r のいずれか 1 つ) を除いた長さを返す
 * (php_fgetcsv_lookup_trailing_spaces())
 */
function trimLineEnd(str){
	var len = str.length;
	if( len && str.charAt(len - 1) === '\n' ){
		return (len > 1 && str.charAt(len - 2) === '\r') ? len - 2 : len - 1;
	}
	if( len && str.charAt(len - 1) === '\r' ){
		return len - 1;
	}
	return len;
}

/**
 * 1 行 (引用符の中に改行があれば、続く行も) を読んで、セルの配列を返す
 *
 * 空行は [null] を返す (fgetcsv() と同じ)。
 * 文字列の末尾を越えた位置の文字は '' になり、C の終端文字 '\0' と同じように、区切り文字にも引用符にもならない。
 */
function parseRow(buf, nextLine){
	var limit = trimLineEnd(buf);
	var lineEnd = buf.slice(limit);
	var ptr = 0;
	var inc;
	var firstField = true;
	var row = [];

	do{
		var field = '';
		var hunk;

		inc = (ptr < limit) ? 1 : 0;
		if( inc === 1 ){
			// 引用符の前の空白は読み飛ばす
			var tmp = ptr;
			while( buf.charAt(tmp) !== DELIMITER && isSpace(buf.charAt(tmp)) ){
				tmp ++;
			}
			if( buf.charAt(tmp) === ENCLOSURE && tmp < limit ){
				ptr = tmp;
			}
		}

		if( firstField && ptr === limit ){
			// 空行
			return [null];
		}
		firstField = false;

		if( inc !== 0 && buf.charAt(ptr) === ENCLOSURE ){
			// 引用符で囲まれたセル
			// (エスケープ文字を使わないので、状態は 0: 通常 と 2: 直前が引用符 だけ)
			var state = 0;
			ptr ++;
			hunk = ptr;
			for(;;){
				if( inc === 0 ){
					if( state === 2 ){
						// 行末の閉じる引用符
						field += buf.slice(hunk, ptr - 1);
						hunk = ptr;
						break;
					}
					if( hunk !== limit ){
						field += buf.slice(hunk, ptr);
						hunk = ptr;
					}
					// 引用符の中の改行は、セルの値に含めて次の行を読む
					field += lineEnd;
					var next = nextLine();
					if( next === null ){
						// 閉じていない引用符は、末尾までを 1 つのセルにする
						if( ptr > limit ){
							if( hunk === ptr ){
								hunk --;
							}
							ptr --;
						}
						break;
					}
					buf = next;
					ptr = 0;
					hunk = 0;
					limit = trimLineEnd(buf);
					lineEnd = buf.slice(limit);
					state = 0;
				}else if( state === 2 ){
					if( buf.charAt(ptr) !== ENCLOSURE ){
						// 閉じる引用符
						field += buf.slice(hunk, ptr - 1);
						hunk = ptr;
						break;
					}
					// "" は " にする
					field += buf.slice(hunk, ptr);
					ptr ++;
					hunk = ptr;
					state = 0;
				}else{
					if( buf.charAt(ptr) === ENCLOSURE ){
						state = 2;
					}
					ptr ++;
				}
				inc = (ptr < limit) ? 1 : 0;
			}

			// 閉じる引用符の後ろは、次の区切り文字までをそのまま加える
			while( inc !== 0 && buf.charAt(ptr) !== DELIMITER ){
				ptr ++;
				inc = (ptr < limit) ? 1 : 0;
			}
			field += buf.slice(hunk, ptr);
			ptr += inc;
		}else{
			// 引用符で囲まれていないセル
			hunk = ptr;
			while( inc !== 0 && buf.charAt(ptr) !== DELIMITER ){
				ptr ++;
				inc = (ptr < limit) ? 1 : 0;
			}
			field = buf.slice(hunk, ptr);
			field = field.slice(0, trimLineEnd(field));
			if( buf.charAt(ptr) === DELIMITER ){
				ptr ++;
			}
		}

		row.push(field);
	}while( inc > 0 );

	return row;
}

/**
 * CSV 文字列をパースする
 *
 * PHP版の前処理も同じようにする: 先頭の BOM を除き、LF を 1 つも含まなければ CR を LF にする。
 */
function parseCsv(src){
	src = String(src);
	if( src.charAt(0) === '﻿' ){
		src = src.slice(1);
	}
	if( src.indexOf('\n') < 0 ){
		// CR だけで改行された CSV
		src = src.replace(/\r/g, '\n');
	}

	// php_stream_get_line() と同じく、LF までを 1 行として (LF を含めて) 読む
	var pos = 0;
	function nextLine(){
		if( pos >= src.length ){
			return null;
		}
		var end = src.indexOf('\n', pos);
		end = (end < 0) ? src.length : end + 1;
		var line = src.slice(pos, end);
		pos = end;
		return line;
	}

	var rows = [];
	var line;
	while( (line = nextLine()) !== null ){
		rows.push(parseRow(line, nextLine));
	}
	return rows;
}

module.exports = parseCsv;
