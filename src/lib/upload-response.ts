import { MAX_UPLOAD_MB } from "@/lib/upload-constants";

interface ErrorPayload {
	error?: string;
	message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readPayloadError(payload: unknown): string | null {
	if (!isRecord(payload)) {
		return null;
	}
	const error = typeof payload.error === "string" ? payload.error.trim() : "";
	if (error) {
		return error;
	}
	const message = typeof payload.message === "string" ? payload.message.trim() : "";
	return message || null;
}

function mapFallbackUploadError(status: number, rawText: string): string {
	const text = rawText.toLowerCase();
	if (
		status === 413 ||
		text.includes("content too large") ||
		text.includes("request entity too large") ||
		text.includes("payload too large")
	) {
		return `파일이 너무 큼. ${MAX_UPLOAD_MB}MB 이하 파일만 업로드 가능`;
	}
	if (status === 401) {
		return "로그인이 필요함";
	}
	if (status >= 500) {
		return "서버 오류로 업로드 실패. 잠시 후 다시 시도해줘";
	}
	return "파일 업로드 실패";
}

export async function parseUploadJsonResponse<T>(
	response: Response
): Promise<{ data: T | null; error: string | null }> {
	let payload: unknown = null;
	try {
		payload = await response.clone().json();
	} catch {
		payload = null;
	}

	if (response.ok) {
		if (payload === null) {
			return { data: null, error: "서버 응답을 읽지 못했어. 다시 시도해줘" };
		}
		return { data: payload as T, error: null };
	}

	const payloadError = readPayloadError(payload);
	if (payloadError) {
		return { data: null, error: payloadError };
	}

	const rawText = (await response.text().catch(() => "")).trim();
	return { data: null, error: mapFallbackUploadError(response.status, rawText) };
}

export function parseUploadXhrError(status: number, rawBody: string): string {
	const payload = (() => {
		try {
			return JSON.parse(rawBody) as ErrorPayload;
		} catch {
			return null;
		}
	})();

	const payloadError = readPayloadError(payload);
	if (payloadError) {
		return payloadError;
	}
	return mapFallbackUploadError(status, rawBody.trim());
}
