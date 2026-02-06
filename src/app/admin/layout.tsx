import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const adminLinks = [
	{ href: "/admin", label: "Dashboard" },
	{ href: "/admin/users", label: "Users" },
	{ href: "/admin/posts", label: "Posts" },
	{ href: "/admin/inquiries", label: "Inquiries" },
	{ href: "/admin/backup", label: "Backup" },
];

export default async function AdminLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await auth();
	if (!session?.user) {
		redirect("/login?callbackUrl=/admin");
	}
	if (session.user.role !== "admin") {
		redirect("/");
	}

	return (
		<div className="max-w-7xl mx-auto p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Admin Console</h1>
				<span className="text-sm text-text-muted">
					{session.user.nickname} ({session.user.role})
				</span>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
				<aside className="bg-bg-secondary border border-border rounded-lg p-3 h-fit">
					<nav className="space-y-1">
						{adminLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="block px-3 py-2 rounded text-sm hover:bg-bg-tertiary transition-colors"
							>
								{link.label}
							</Link>
						))}
					</nav>
				</aside>

				<section className="bg-bg-secondary border border-border rounded-lg p-4 md:p-6">
					{children}
				</section>
			</div>
		</div>
	);
}

