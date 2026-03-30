import { describe, expect, it } from "vitest";

import {
	isMissingPostBoardMetadataColumnError,
	isMissingPostBoardColumnError,
	isMissingPostServerAddressColumnError,
} from "@/lib/db-schema-guard";

describe("db-schema-guard", () => {
	it("Prisma P2022 board 컬럼 메시지도 레거시 board 누락으로 인식해야 함", () => {
		const error = new Error("The column `board` does not exist in the current database.");

		expect(isMissingPostBoardColumnError(error)).toBe(true);
		expect(isMissingPostBoardMetadataColumnError(error)).toBe(true);
	});

	it("Prisma P2022 serverAddress 컬럼 메시지도 레거시 metadata 누락으로 인식해야 함", () => {
		const error = new Error("The column `serverAddress` does not exist in the current database.");

		expect(isMissingPostServerAddressColumnError(error)).toBe(true);
		expect(isMissingPostBoardMetadataColumnError(error)).toBe(true);
	});
});
