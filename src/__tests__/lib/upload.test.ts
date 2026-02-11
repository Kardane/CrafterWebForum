import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/upload-constants";
import { UploadValidationError, validateUploadFile } from "@/lib/upload";

describe("upload validation", () => {
	it("accepts mp4 uploads as video kind", () => {
		const file = new File([new Uint8Array([1, 2, 3])], "clip.mp4", {
			type: "video/mp4",
		});

		const validated = validateUploadFile(file);
		expect(validated.kind).toBe("video");
		expect(validated.extension).toBe("mp4");
	});

	it("accepts webm uploads as video kind", () => {
		const file = new File([new Uint8Array([1, 2, 3])], "clip.webm", {
			type: "video/webm",
		});

		const validated = validateUploadFile(file);
		expect(validated.kind).toBe("video");
		expect(validated.extension).toBe("webm");
	});

	it("rejects extension and mime mismatch", () => {
		const file = new File([new Uint8Array([1, 2, 3])], "clip.mp4", {
			type: "image/png",
		});

		expect(() => validateUploadFile(file)).toThrowError(UploadValidationError);
	});

	it("rejects files larger than max upload size", () => {
		const file = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "large.mp4", {
			type: "video/mp4",
		});

		expect(() => validateUploadFile(file)).toThrowError(
			`File exceeds ${MAX_UPLOAD_MB}MB limit`
		);
	});
});
