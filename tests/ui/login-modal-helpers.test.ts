import { shouldPreventTwoFactorKeydown } from "@ui/login-modal-helpers";
import { describe, expect, test } from "vitest";

describe("shouldPreventTwoFactorKeydown", () => {
	test("allows numeric input", () => {
		expect(
			shouldPreventTwoFactorKeydown({
				key: "3",
				metaKey: false,
				ctrlKey: false,
				altKey: false,
			}),
		).toBe(false);
	});

	test("blocks plain non-digit input", () => {
		expect(
			shouldPreventTwoFactorKeydown({
				key: "v",
				metaKey: false,
				ctrlKey: false,
				altKey: false,
			}),
		).toBe(true);
	});

	test("allows ctrl+v for paste", () => {
		expect(
			shouldPreventTwoFactorKeydown({
				key: "v",
				metaKey: false,
				ctrlKey: true,
				altKey: false,
			}),
		).toBe(false);
	});

	test("allows cmd+v for paste", () => {
		expect(
			shouldPreventTwoFactorKeydown({
				key: "v",
				metaKey: true,
				ctrlKey: false,
				altKey: false,
			}),
		).toBe(false);
	});
});
