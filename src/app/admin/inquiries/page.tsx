import { redirect } from "next/navigation";

export default function AdminInquiriesPage() {
	redirect("/admin?tab=inquiries");
}
