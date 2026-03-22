import type { DriveSyncErrorCode, ErrorCategory } from "@errors";
import {
	type DriveSyncError,
	normalizeUnknownDriveSyncError,
	translateDriveSyncErrorUserMessage,
} from "@errors";
import { trAny } from "@i18n";
import { Notice } from "obsidian";

export type DriveSyncErrorNoticeOptions = {
	logMessage?: string;
	noticeKey?: string;
	noticeParams?: Record<string, string | number | boolean>;
	userMessageParams?: Record<string, string | number | boolean>;
	code?: string;
	category?: string;
	retryable?: boolean;
	userMessage?: string;
	userMessageKey?: string;
};

export function prepareDriveSyncErrorNotice(
	error: unknown,
	options: DriveSyncErrorNoticeOptions = {},
): { normalized: DriveSyncError; message: string } {
	const normalized = normalizeUnknownDriveSyncError(error, {
		code: options.code as DriveSyncErrorCode | undefined,
		category: options.category as ErrorCategory | undefined,
		retryable: options.retryable,
		userMessage: options.userMessage ?? trAny(options.noticeKey ?? "", options.noticeParams),
		userMessageKey: options.userMessageKey ?? options.noticeKey,
		userMessageParams: options.userMessageParams,
	});
	if (options.logMessage) {
		console.warn(options.logMessage, error);
	}
	return {
		normalized,
		message: translateDriveSyncErrorUserMessage(normalized, trAny),
	};
}

export function showDriveSyncErrorNotice(
	error: unknown,
	options: DriveSyncErrorNoticeOptions = {},
): DriveSyncError {
	const prepared = prepareDriveSyncErrorNotice(error, options);
	new Notice(prepared.message);
	return prepared.normalized;
}
