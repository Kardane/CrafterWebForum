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

export default async function Home(props: PageProps) {
	const session = await auth();
	if (!session?.user) {
		redirect("/login?callbackUrl=/");
	}

	const sessionUserId = toSessionUserId(session.user.id);
	if (!sessionUserId) {
		redirect("/login?callbackUrl=/");
	}

	const searchParams = await props.searchParams;
	let data;
	try {
		data = await listPosts({
			page: 1,
			limit: toPositiveInt(searchParams.limit, 12),
			board: "forum",
			tag: searchParams.tag ?? null,
			sort: searchParams.sort ?? "activity",
			search: searchParams.search ?? "",
			searchInComments: false,
			sessionUserId,
		});
	} catch (error) {
		console.error("Failed to load posts:", error);
		data = { posts: [], metadata: { total: 0, totalPages: 0, page: 1, limit: 12 } };
	}

	return (
		<div className="max-w-4xl mx-auto">
			<PostFilters totalPosts={Number(data.metadata.total ?? 0)} board="forum" />

			<div className="min-h-[500px]">
				<PostList
					initialPosts={data.posts || []}
					totalPages={data.metadata.totalPages || 0}
					initialPage={Number(data.metadata.page || 1)}
					initialLimit={Number(data.metadata.limit || 12)}
					board="forum"
				/>
			</div>
		</div>
	);
}
