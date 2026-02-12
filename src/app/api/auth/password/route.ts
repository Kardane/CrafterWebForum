import { NextResponse } from "next/server";

/**
 * @deprecated — canonical: /api/users/me/password
 * 이 엔드포인트는 제거되었음.
 */
export async function PUT() {
	return NextResponse.json(
		{ error: "gone", message: "이 API는 제거되었습니다. /api/users/me/password를 사용하세요." },
		{ status: 410 }
	);
}
