export class JsonBodyError extends Error {
	status: number;
	code: string;

	constructor(message: string, status: number, code: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

interface ReadJsonBodyOptions {
	maxBytes?: number;
}

export async function readJsonBody(request: Request, options: ReadJsonBodyOptions = {}): Promise<unknown> {
	const maxBytes = options.maxBytes ?? 512 * 1024;
	const contentLengthHeader = request.headers.get("content-length");
	if (contentLengthHeader) {
		const contentLength = Number.parseInt(contentLengthHeader, 10);
		if (Number.isFinite(contentLength) && contentLength > maxBytes) {
			throw new JsonBodyError("payload_too_large", 413, "payload_too_large");
		}
	}

	try {
		return await request.json();
	} catch {
		throw new JsonBodyError("invalid_json", 400, "invalid_json");
	}
}
