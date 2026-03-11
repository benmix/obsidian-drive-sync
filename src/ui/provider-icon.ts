import { siProtondrive } from "simple-icons";

export function renderProviderIcon(
	containerEl: HTMLElement,
	providerId: string,
	providerLabel: string,
	className = "drive-sync-provider-icon",
): void {
	const iconSvg = getProviderIconSvg(providerId);
	if (!iconSvg) {
		return;
	}
	const iconEl = containerEl.createSpan({
		cls: className,
		attr: { "aria-label": providerLabel },
	});
	iconEl.innerHTML = iconSvg;
}

function getProviderIconSvg(providerId: string): string | null {
	if (providerId === "proton-drive") {
		return `<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
			<path fill="currentColor" d="${siProtondrive.path}"/>
		</svg>`;
	}
	return null;
}
