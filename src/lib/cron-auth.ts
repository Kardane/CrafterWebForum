import { createHash, timingSafeEqual } from "node:crypto";

export function isAuthorizedCronRequest(request: Request): boolean {
	const cronSecret = (process.env.CRON_SECRET ?? "").trim();
	if (!cronSecret) {
		return false;
	}

	const authorization = request.headers.get("authorization") ?? "";
	const expected = `Bearer ${cronSecret}`;
	const authDigest = createHash("sha256").update(authorization).digest();
	const expectedDigest = createHash("sha256").update(expected).digest();
	return timingSafeEqual(authDigest, expectedDigest);
}
