import fs from "fs";
import path from "path";
import { afterEach, describe, expect, test } from "vitest";
import { localStorageFile, removeStoragePaths } from "@/lib/utils/server/storage";

const uploadProbe = path.join(process.cwd(), "public", "uploads", "qa-storage-probe.txt");
const exampleProbe = path.join(process.cwd(), "public", "static", "examples", "qa-storage-probe.txt");

afterEach(() => {
	for (const file of [uploadProbe, exampleProbe]) {
		if (fs.existsSync(file)) fs.unlinkSync(file);
	}
	delete process.env.NEXT_PUBLIC_SUPABASE_URL;
});

describe("local storage removal", () => {
	test("finds a dev upload and a seed fixture, and refuses a path that escapes", () => {
		fs.mkdirSync(path.dirname(uploadProbe), { recursive: true });
		fs.writeFileSync(uploadProbe, "upload");
		fs.writeFileSync(exampleProbe, "example");

		expect(localStorageFile("qa-storage-probe.txt")).toBe(uploadProbe);
		expect(localStorageFile("../package.json")).toBeNull();

		fs.unlinkSync(uploadProbe);
		expect(localStorageFile("qa-storage-probe.txt")).toBe(exampleProbe);
	});

	test("removeStoragePaths deletes the local file when Supabase is unset", async () => {
		delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		fs.mkdirSync(path.dirname(uploadProbe), { recursive: true });
		fs.writeFileSync(uploadProbe, "upload");

		await removeStoragePaths(["qa-storage-probe.txt", "qa-storage-probe.txt"]);

		expect(fs.existsSync(uploadProbe)).toBe(false);
	});
});
