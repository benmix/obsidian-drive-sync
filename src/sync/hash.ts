export async function hashBytes(data: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", data);
	const bytes = new Uint8Array(digest);
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
