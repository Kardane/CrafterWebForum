import AdminTabNav, { AdminTabId, isAdminTabId } from "@/components/admin/AdminTabNav";
import AdminBackupTab from "@/components/admin/tabs/AdminBackupTab";
import AdminDashboardTab from "@/components/admin/tabs/AdminDashboardTab";
import AdminInquiriesTab from "@/components/admin/tabs/AdminInquiriesTab";
import AdminPostsTab from "@/components/admin/tabs/AdminPostsTab";
import AdminUsersTab from "@/components/admin/tabs/AdminUsersTab";

interface AdminPageProps {
	searchParams: Promise<{ tab?: string | string[] }>;
}

function renderTabContent(tab: AdminTabId) {
	if (tab === "users") {
		return <AdminUsersTab />;
	}
	if (tab === "posts") {
		return <AdminPostsTab />;
	}
	if (tab === "inquiries") {
		return <AdminInquiriesTab />;
	}
	if (tab === "backup") {
		return <AdminBackupTab />;
	}
	return <AdminDashboardTab />;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
	const resolvedSearchParams = await searchParams;
	const tabParam = Array.isArray(resolvedSearchParams.tab)
		? resolvedSearchParams.tab[0]
		: resolvedSearchParams.tab;
	const activeTab: AdminTabId = isAdminTabId(tabParam) ? tabParam : "dashboard";

	return (
		<div>
			<AdminTabNav activeTab={activeTab} />
			{renderTabContent(activeTab)}
		</div>
	);
}
