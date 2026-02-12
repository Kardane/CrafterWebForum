/**
 * @deprecated — canonical: /api/users/me/minecraft-reauth
 * 이 엔드포인트는 제거되었음.
 */
import { NextResponse } from "next/server";

export async function POST() {
	return NextResponse.json(
		{ error: "gone", message: "이 API는 제거되었습니다. /api/users/me/minecraft-reauth를 사용하세요." },
		{ status: 410 }
	);
}
