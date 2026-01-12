export type SdkOptionsParseResult = {
	options: Record<string, unknown>;
	error?: string;
};

export function parseSdkOptions(raw: string): SdkOptionsParseResult {
	if (!raw.trim()) {
		return {options: {}};
	}

	try {
		const parsed = JSON.parse(raw);
		if (!isPlainRecord(parsed)) {
			return {options: {}, error: "SDK options must be a JSON object."};
		}
		return {options: parsed};
	} catch (error) {
		console.warn("Failed to parse Proton Drive SDK options.", error);
		return {options: {}, error: "SDK options JSON is invalid."};
	}
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
