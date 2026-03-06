export async function hashBytes(data: Uint8Array): Promise<string> {
	const buffer = new Uint8Array(data).buffer;
	const digest = await crypto.subtle.digest("SHA-256", buffer);
	const bytes = new Uint8Array(digest);
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
