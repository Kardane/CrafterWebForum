import { auth } from "@/auth";
import classNames from "classnames";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import { toSessionUserId } from "@/lib/session-user";
import { getBoardLabel, type PostBoardType } from "@/lib/post-board";
import { listPosts } from "@/lib/services/posts-service";
import PostFilters from "@/components/posts/PostFilters";
import PostList from "@/components/posts/PostList";

function toPositiveInt(value: string | undefined, fallback: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return fallback;
	}
	return parsed;
}

function BoardFeedFallback() {
	return (
		<div className="flex flex-col gap-6">
			<div className="h-20 rounded-lg border border-bg-tertiary bg-bg-secondary/60" />
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{Array.from({ length: 8 }).map((_, index) => (
					<div
						key={`board-skeleton-${index}`}
						className="h-40 rounded-lg border border-bg-tertiary bg-bg-secondary/60"
					/>
				))}
			</div>
		</div>
	);
}

async function BoardFeedSection({
	board,
	searchParams,
	sessionUserId,
	canCreate,
}: {
	board: PostBoardType;
	searchParams: { [key: string]: string | undefined };
	sessionUserId: number;
	canCreate: boolean;
}) {
	let data;
	try {
		data = await listPosts({
			page: 1,
			limit: toPositiveInt(searchParams.limit, 12),
			board,
			tag: board === "sinmungo" ? null : (searchParams.tag ?? null),
			sort: searchParams.sort ?? "activity",
			search: searchParams.search ?? "",
			searchInComments: false,
			sessionUserId,
		});
	} catch (error) {
		console.error(`Failed to load ${board} posts:`, error);
		data = { posts: [], metadata: { total: 0, totalPages: 0, page: 1, limit: 12 } };
	}

	return (
		<>
			<div className="mb-4 rounded-2xl border border-border bg-bg-secondary/70 px-5 py-4">
				<div className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Board</div>
				<h1 className="mt-1 text-2xl font-bold text-text-primary">{getBoardLabel(board)}</h1>
				<p className="mt-1 text-sm text-text-secondary">
					{board === "sinmungo"
						? "운영 서버 관련 제보와 문제 상황을 기록하는 공간"
						: "개발 관련 포스트와 자료를 모아보는 메인 피드"}
				</p>
			</div>

			<PostFilters totalPosts={Number(data.metadata.total ?? 0)} board={board} canCreate={canCreate} />

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

export default async function BoardFeedPage({
	board,
	searchParams,
}: {
	board: PostBoardType;
	searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
	const session = await auth();
	const activeUser = await resolveActiveUserFromSession(session, {
		requireApproved: board !== "sinmungo",
	});
	if (!activeUser.ok) {
		if (activeUser.error === "pending_approval") {
			redirect(board === "sinmungo" ? "/sinmungo" : "/?toast=approval-required");
		}
		redirect(`/login?callbackUrl=${encodeURIComponent(board === "sinmungo" ? "/sinmungo" : "/develope")}`);
	}

	const sessionUserId = toSessionUserId(activeUser.context.userId);
	if (!sessionUserId) {
		redirect(`/login?callbackUrl=${encodeURIComponent(board === "sinmungo" ? "/sinmungo" : "/develope")}`);
	}

	const resolvedSearchParams = await searchParams;

	const canCreate = activeUser.context.isApproved === 1;

	return (
		<div className="mx-auto max-w-4xl">
			<Suspense fallback={<BoardFeedFallback />}>
				<BoardFeedSection board={board} searchParams={resolvedSearchParams} sessionUserId={sessionUserId} canCreate={canCreate} />
			</Suspense>
		</div>
	);
}
