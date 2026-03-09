import { getLanguage } from "obsidian";

import type { SupportedLocale, TranslationParams } from "../contracts/i18n";

import { EN } from "./locales/en-US";
import { ZH } from "./locales/zh-CN";

type TranslationKey = keyof typeof EN;

function normalizeLocale(locale: string | undefined): SupportedLocale {
	if (!locale) {
		return "en-US";
	}
	return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

function resolveLocale(): SupportedLocale {
	try {
		const language = getLanguage();
		if (typeof language === "string" && language.trim()) {
			return normalizeLocale(language);
		}
	} catch {
		// Ignore and use fallback locale.
	}
	return normalizeLocale(navigator.language);
}

function interpolate(template: string, params?: TranslationParams): string {
	if (!params) {
		return template;
	}
	return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

function t(locale: SupportedLocale, key: TranslationKey, params?: TranslationParams): string {
	const dict = locale === "zh-CN" ? ZH : EN;
	return interpolate(dict[key] ?? EN[key], params);
}

export function tr(key: TranslationKey, params?: TranslationParams): string {
	return t(resolveLocale(), key, params);
}

export function trAny(key: string, params?: TranslationParams): string {
	const locale = resolveLocale();
	const dict = locale === "zh-CN" ? ZH : EN;
	const template = dict[key as TranslationKey] ?? EN[key as TranslationKey] ?? key;
	return interpolate(template, params);
}
