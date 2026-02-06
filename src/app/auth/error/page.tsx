import Link from "next/link";

interface ErrorPageProps {
	searchParams: Promise<{ error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
	Configuration: "인증 설정에 문제가 있습니다. 관리자에게 문의해주세요.",
	AccessDenied: "접근이 거부되었습니다.",
	Verification: "인증 토큰 검증에 실패했습니다.",
	CredentialsSignin: "로그인 정보가 올바르지 않습니다.",
};

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
	const params = await searchParams;
	const errorCode = params.error ?? "Unknown";
	const message = ERROR_MESSAGES[errorCode] ?? "인증 중 알 수 없는 오류가 발생했습니다.";

	return (
		<div className="max-w-md mx-auto py-12 px-4">
			<div className="bg-bg-secondary border border-border rounded-xl p-6 shadow-lg space-y-4">
				<h1 className="text-2xl font-bold text-error">인증 오류</h1>
				<p className="text-text-primary">{message}</p>
				<div className="text-sm text-text-muted bg-bg-tertiary rounded-md px-3 py-2">
					오류 코드: <span className="font-mono">{errorCode}</span>
				</div>

				<div className="flex gap-3 pt-2">
					<Link href="/login" className="btn btn-primary">
						로그인 다시 시도
					</Link>
					<Link href="/" className="btn btn-secondary">
						홈으로 이동
					</Link>
				</div>
			</div>
		</div>
	);
}
