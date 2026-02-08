"use client";

function getAdminLoginUrl() {
	if (typeof window === "undefined") {
		return "/login?callbackUrl=/admin";
	}
	const callbackUrl = `${window.location.pathname}${window.location.search}` || "/admin";
	return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

function redirectToLogin() {
	if (typeof window !== "undefined") {
		window.location.href = getAdminLoginUrl();
	}
}

async function readErrorMessage(response: Response) {
	try {
		const data = (await response.json()) as { error?: string };
		if (typeof data.error === "string" && data.error.length > 0) {
			return data.error;
		}
	} catch {
		// 응답 본문이 JSON이 아니면 기본 메시지 사용
	}
	return `Request failed (${response.status})`;
}

export async function fetchAdminResponse(input: RequestInfo | URL, init?: RequestInit) {
	const response = await fetch(input, {
		cache: "no-store",
		...init,
	});

	if (response.status === 401 || response.status === 403) {
		redirectToLogin();
		throw new Error("AUTH_REQUIRED");
	}

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	return response;
}

export async function fetchAdminJson<T>(input: RequestInfo | URL, init?: RequestInit) {
	const response = await fetchAdminResponse(input, init);
	return (await response.json()) as T;
}
