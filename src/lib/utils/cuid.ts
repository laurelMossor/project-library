const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** A caller-chosen id in the same shape Prisma's `@default(cuid())` generates. */
export function createCuid(): string {
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);
	let id = "c";
	for (const byte of bytes) id += ALPHABET[byte % 36];
	return id;
}
