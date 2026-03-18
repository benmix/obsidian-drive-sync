export type TwoFactorKeydownEventLike = {
	key: string;
	metaKey: boolean;
	ctrlKey: boolean;
	altKey: boolean;
};

export function shouldPreventTwoFactorKeydown(event: TwoFactorKeydownEventLike): boolean {
	if (event.metaKey || event.ctrlKey || event.altKey) {
		return false;
	}

	return event.key.length === 1 && !/^\d$/.test(event.key);
}
