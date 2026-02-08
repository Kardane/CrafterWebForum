import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import PostContent from "@/components/posts/PostContent";
import LikeButton from "@/components/posts/LikeButton";
import CommentSection from "@/components/comments/CommentSection";
import PostStickyHeader from "@/components/posts/PostStickyHeader";
import { PostLikeStateProvider } from "@/components/posts/PostLikeStateProvider";
import { toSessionUserId } from "@/lib/session-user";

interface PostDetailPageProps {
	params: Promise<{ id: string }>;
}

function countCommentsWithReplies(
	nodes: Array<{ replies?: Array<{ replies?: unknown[] }> }>
): number {
	return nodes.reduce((sum, node) => {
		const replies = Array.isArray(node.replies)
			? (node.replies as Array<{ replies?: Array<{ replies?: unknown[] }> }>)
			: [];
		return sum + 1 + countCommentsWithReplies(replies);
	}, 0);
}

async function getPostDetail(id: string) {
	const requestHeaders = await headers();
	const host =
		requestHeaders.get("x-forwarded-host") ??
		requestHeaders.get("host") ??
		null;
	const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

	// 서버 컴포넌트 내부 호출 시 쿠키를 전달해야 인증 세션이 유지됨
	const baseUrl = host
		? `${protocol}://${host}`
		: process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000";
	const cookieHeader = requestHeaders.get("cookie");

	const res = await fetch(`${baseUrl}/api/posts/${id}`, {
		cache: "no-store",
		headers: cookieHeader ? { cookie: cookieHeader } : undefined,
	});

	if (!res.ok) {
		return null;
	}

	return res.json();
}

function getMinecraftHeadUrl(uuid: string | null, size = 32): string | null {
	if (!uuid) return null;
	return `https://api.mineatar.io/face/${uuid}?scale=${Math.ceil(size / 8)}`;
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
	const { id } = await params;
	const session = await auth();
	if (!session?.user) {
		redirect("/login");
	}

	const data = await getPostDetail(id);
	if (!data?.post) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[400px] text-center">
				<h2 className="text-2xl font-bold mb-4">게시글을 찾을 수 없습니다</h2>
				<p className="text-text-secondary mb-6">삭제되었거나 존재하지 않는 게시글입니다.</p>
				<Link href="/" className="btn btn-primary">
					목록으로 돌아가기
				</Link>
			</div>
		);
	}

	const { post, comments } = data;
	const totalCommentCount = countCommentsWithReplies(comments);
	const sessionUserId = toSessionUserId(session.user.id);
	const isOwner = sessionUserId === post.author_id;

	return (
		<PostLikeStateProvider
			postId={post.id}
			initialLikes={post.likes}
			initialLiked={post.user_liked}
		>
			<div className="max-w-4xl mx-auto px-2 pb-6 pt-1 md:px-4">
				<PostStickyHeader
					postId={post.id}
					title={post.title}
					authorName={post.author_name}
					createdAt={post.createdAt}
					initialLikes={post.likes}
					initialLiked={post.user_liked}
					commentCount={totalCommentCount}
					triggerId="post-header-trigger"
					topOffsetClassName="top-0"
					observerOffsetTop={0}
				/>
				<div id="post-header-trigger" className="h-px" />

				<div className="flex items-center justify-between mb-6">
					<Link href="/" className="btn btn-secondary btn-sm">
						<ArrowLeft size={16} />
						목록
					</Link>
					{isOwner && (
						<Link href={`/posts/${post.id}/edit`} className="btn btn-secondary btn-sm">
							수정
						</Link>
					)}
				</div>

				<div className="mb-6">
					<h1 className="text-2xl md:text-[2rem] font-bold text-text-primary mb-4 leading-[1.3]">
						{post.title}
					</h1>

					{post.tags && post.tags.length > 0 && (
						<div className="flex flex-wrap gap-2 mb-4">
							{post.tags.map((tag: string) => (
								<span
									key={tag}
									className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-[#4a4d52] text-white"
								>
									{tag}
								</span>
							))}
						</div>
					)}

					<div className="flex items-center gap-3 py-3 border-b border-border">
						{post.author_uuid ? (
							<img
								src={getMinecraftHeadUrl(post.author_uuid, 40) || ""}
								alt=""
								className="w-10 h-10 rounded-[4px] [image-rendering:pixelated]"
							/>
						) : (
							<div className="w-10 h-10 rounded-[4px] bg-bg-tertiary flex items-center justify-center font-semibold text-text-muted">
								{post.author_name[0].toUpperCase()}
							</div>
						)}
						<div className="flex-1">
							<div className="font-semibold text-text-primary text-base">{post.author_name}</div>
							<div className="text-[0.85rem] text-text-muted mt-0.5">
								{new Date(post.createdAt).toLocaleString("ko-KR")}
							</div>
						</div>
					</div>
				</div>

				<div className="border border-border rounded-lg p-6 my-6 min-h-[200px] max-md:p-4">
					<PostContent content={post.content} />
				</div>

				<div className="flex items-center gap-4 py-4 border-b border-border mb-6">
					<LikeButton postId={post.id} initialLikes={post.likes} initialLiked={post.user_liked} variant="legacy" />
					<div className="flex items-center gap-1.5 text-text-secondary text-[0.9rem]">
						<MessageCircle size={16} />
						<span>{totalCommentCount}</span>
					</div>
				</div>

				<div className="mt-8">
					<CommentSection postId={post.id} initialComments={comments} />
				</div>
			</div>
		</PostLikeStateProvider>
	);
}
