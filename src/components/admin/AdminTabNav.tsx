import Link from "next/link";
import classNames from "classnames";

export const ADMIN_TABS = [
	{ id: "users", label: "유저" },
	{ id: "dashboard", label: "대시보드" },
	{ id: "posts", label: "포스트" },
	{ id: "backup", label: "백업" },
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

export function isAdminTabId(value: string | undefined): value is AdminTabId {
	if (!value) {
		return false;
	}
	return ADMIN_TABS.some((tab) => tab.id === value);
}

interface AdminTabNavProps {
	activeTab: AdminTabId;
}

export default function AdminTabNav({ activeTab }: AdminTabNavProps) {
	return (
		<nav aria-label="관리자 탭" className="mb-5 overflow-x-auto">
			<div className="inline-flex min-w-full items-center gap-2">
				{ADMIN_TABS.map((tab) => {
					const isActive = tab.id === activeTab;
					return (
						<Link
							key={tab.id}
							href={`/admin?tab=${tab.id}`}
							className={classNames(
								"inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors whitespace-nowrap",
								isActive
									? "border-accent bg-accent/15 text-text-primary"
									: "border-border bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
							)}
						>
							<span>{tab.label}</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
