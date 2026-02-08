import { redirect } from "next/navigation";

export default function AdminBackupPage() {
	redirect("/admin?tab=backup");
}
