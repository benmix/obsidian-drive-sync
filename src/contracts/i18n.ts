export type SupportedLocale = "en-US" | "zh-CN";

export type TranslationParams = Record<string, string | number | boolean>;

export type TranslationDictionary = Record<string, string>;

export type Translator = (key: string, params?: TranslationParams) => string;
