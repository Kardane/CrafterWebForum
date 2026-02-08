import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPrivilegedNickname } from "@/config/admin-policy";

export default async function AdminLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await auth();
	if (!session?.user) {
		redirect("/login?callbackUrl=/admin");
	}
	const hasAdminRole = session.user.role === "admin";
	const hasPrivilegedNickname = isPrivilegedNickname(session.user.nickname);
	if (!hasAdminRole && !hasPrivilegedNickname) {
		redirect("/");
	}

	return (
		<div className="max-w-7xl mx-auto p-4 md:p-6">
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Link href="/" className="btn btn-secondary btn-sm">
						← 메인
					</Link>
					<div>
						<h1 className="text-2xl font-bold">관리자 패널</h1>
					</div>
				</div>
			</div>

			<section className="rounded-lg border border-border bg-bg-secondary p-4 md:p-6">
				{children}
			</section>
		</div>
	);
}
