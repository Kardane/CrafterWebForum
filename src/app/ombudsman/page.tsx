import PostFilters from "@/components/posts/PostFilters";
import PostList from "@/components/posts/PostList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listPosts } from "@/lib/services/posts-service";
import { toSessionUserId } from "@/lib/session-user";

export const preferredRegion = "icn1";

function toPositiveInt(value: string | undefined, fallback: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return fallback;
	}
	return parsed;
}

interface PageProps {
	searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function OmbudsmanPage(props: PageProps) {
	const session = await auth();
	if (!session?.user) {
		redirect("/login?callbackUrl=/ombudsman");
	}

	const sessionUserId = toSessionUserId(session.user.id);
	if (!sessionUserId) {
		redirect("/login?callbackUrl=/ombudsman");
	}

	const searchParams = await props.searchParams;
	let data;
	try {
		data = await listPosts({
			page: 1,
			limit: toPositiveInt(searchParams.limit, 12),
			board: "ombudsman",
			sort: searchParams.sort ?? "activity",
			search: searchParams.search ?? "",
			sessionUserId,
		});
	} catch (error) {
		console.error("Failed to load ombudsman posts:", error);
		data = { posts: [], metadata: { total: 0, totalPages: 0, page: 1, limit: 12 } };
	}

	return (
		<div className="max-w-4xl mx-auto">
			<div className="mb-3 rounded-lg border border-border bg-bg-secondary/70 px-4 py-3">
				<h1 className="text-lg font-bold text-text-primary">서버 신문고</h1>
				<p className="mt-1 text-xs text-text-secondary">서버 오픈 상태를 확인하고 제보/문의 글을 남길 수 있음</p>
			</div>
			<PostFilters totalPosts={Number(data.metadata.total ?? 0)} board="ombudsman" />

			<div className="min-h-[500px]">
				<PostList
					initialPosts={data.posts || []}
					totalPages={data.metadata.totalPages || 0}
					initialPage={Number(data.metadata.page || 1)}
					initialLimit={Number(data.metadata.limit || 12)}
					board="ombudsman"
				/>
			</div>
		</div>
	);
}
