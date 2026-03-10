export function getLanguage(): string {
	return "en-US";
}

export class Notice {
	constructor(_message?: string) {}
}

export class Modal {}

export class Setting {
	addButton(
		callback: (button: {
			setButtonText: (value: string) => void;
			onClick: (handler: () => void) => void;
		}) => void,
	): this {
		callback({
			setButtonText: () => {},
			onClick: () => {},
		});
		return this;
	}
}

export class Plugin {}

export class PluginSettingTab {}

export class TFile {}

export class TFolder {}

export async function requestUrl(): Promise<{
	status: number;
	headers: Record<string, string>;
	arrayBuffer: ArrayBuffer;
	text: string;
	json: unknown;
}> {
	return {
		status: 200,
		headers: {},
		arrayBuffer: new ArrayBuffer(0),
		text: "",
		json: {},
	};
}
