/**
 * langbank.mjs (ESM wrapper)
 */
import LangBank from './LangBank.js';

export type Source = LangBank.Source;
export type CsvArray = LangBank.CsvArray;
export type CsvCell = LangBank.CsvCell;
export type BindData = LangBank.BindData;
export type Key = LangBank.Key;
export type Options = LangBank.Options;
export type HasOptions = LangBank.HasOptions;
export type AutoescapeStrategy = LangBank.AutoescapeStrategy;
export type View = LangBank.View;
export type ErrorCode = LangBank.ErrorCode;

export declare const LangBankError: typeof LangBank.LangBankError;
export type LangBankError = LangBank.LangBankError;

export default LangBank;
