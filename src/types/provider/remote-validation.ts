export type ValidationStep = {
	name: string;
	ok: boolean;
	detail?: string;
};

export type RemoteValidationReport = {
	ok: boolean;
	rootFolderId?: string;
	steps: ValidationStep[];
};
