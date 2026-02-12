/**
 * @deprecated — canonical: /api/users/me
 * 이 엔드포인트는 제거되었음. /api/users/me를 사용할 것.
 */
import { NextResponse } from "next/server";

export async function GET() {
	return NextResponse.json(
		{ error: "gone", message: "이 API는 제거되었습니다. /api/users/me를 사용하세요." },
		{ status: 410 }
	);
}
