import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const admin = await requireAdmin();
	if ("response" in admin) {
		redirect("/login?callbackUrl=/admin");
	}

	return (
		<div className="max-w-7xl mx-auto p-4 md:p-6">
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Link href="/develope" className="btn btn-secondary btn-sm">
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
