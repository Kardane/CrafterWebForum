import PostFilters from "@/components/posts/PostFilters";
import PostList from "@/components/posts/PostList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listPosts } from "@/lib/services/posts-service";
import { toSessionUserId } from "@/lib/session-user";
import { Suspense } from "react";
import { resolveActiveUserFromSession } from "@/lib/active-user";

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

interface HomeFeedSectionProps {
	searchParams: { [key: string]: string | undefined };
	sessionUserId: number;
}

function HomeFeedFallback() {
	return (
		<div className="flex flex-col gap-6">
			<div className="h-20 rounded-lg border border-bg-tertiary bg-bg-secondary/60" />
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{Array.from({ length: 8 }).map((_, index) => (
					<div
						key={`home-skeleton-${index}`}
						className="h-40 rounded-lg border border-bg-tertiary bg-bg-secondary/60"
					/>
				))}
			</div>
		</div>
	);
}

async function HomeFeedSection({ searchParams, sessionUserId }: HomeFeedSectionProps) {
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
		<>
			<PostFilters totalPosts={Number(data.metadata.total ?? 0)} />

			<div className="min-h-[500px]">
				<PostList
					initialPosts={data.posts || []}
					totalPages={data.metadata.totalPages || 0}
					initialPage={Number(data.metadata.page || 1)}
					initialLimit={Number(data.metadata.limit || 12)}
				/>
			</div>
		</>
	);
}

export default async function Home(props: PageProps) {
	const session = await auth();
	const activeUser = await resolveActiveUserFromSession(session);
	if (!activeUser.ok) {
		if (activeUser.error === "pending_approval") {
			redirect("/pending");
		}
		redirect("/login?callbackUrl=/");
	}

	const sessionUserId = toSessionUserId(activeUser.context.userId);
	if (!sessionUserId) {
		redirect("/login?callbackUrl=/");
	}

	const searchParams = await props.searchParams;

	return (
		<div className="max-w-4xl mx-auto">
			<Suspense fallback={<HomeFeedFallback />}>
				<HomeFeedSection searchParams={searchParams} sessionUserId={sessionUserId} />
			</Suspense>
		</div>
	);
}
