import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import PostContent from "@/components/posts/PostContent";
import UserAvatar from "@/components/ui/UserAvatar";
import LikeButton from "@/components/posts/LikeButton";
import CommentSection from "@/components/comments/CommentSection";
import PostStickyHeader from "@/components/posts/PostStickyHeader";
import { PostLikeStateProvider } from "@/components/posts/PostLikeStateProvider";
import ServerAddressTag from "@/components/posts/ServerAddressTag";
import { isSessionUserApproved, toSessionUserId } from "@/lib/session-user";
import { getPostDetail } from "@/lib/services/post-detail-service";

export const preferredRegion = "icn1";

interface PostDetailPageProps {
	params: Promise<{ id: string }>;
}

function renderNotFound() {
	return (
		<div className="flex flex-col items-center justify-center min-h-[400px] text-center">
			<h2 className="text-2xl font-bold mb-4">게시글을 찾을 수 없습니다</h2>
			<p className="text-text-secondary mb-6">삭제되었거나 존재하지 않는 게시글입니다</p>
			<Link href="/" className="btn btn-primary">
				목록으로 돌아가기
			</Link>
		</div>
	);
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
	const { id } = await params;
	const session = await auth();
	if (!session?.user) {
		redirect("/login");
	}
	if (!isSessionUserApproved(session.user.isApproved)) {
		redirect("/pending");
	}

	const sessionUserId = toSessionUserId(session.user.id);
	if (!sessionUserId) {
		redirect("/login");
	}

	const postId = Number.parseInt(id, 10);
	if (!Number.isInteger(postId)) {
		return renderNotFound();
	}

	const data = await getPostDetail({ postId, sessionUserId });
	if (!data?.post) {
		return renderNotFound();
	}

	const { post, comments, commentsPage, readMarker } = data;
	const totalCommentCount = readMarker.totalCommentCount;
	const isOwner = sessionUserId === post.author_id;
	const backHref = post.board === "ombudsman" ? "/ombudsman" : "/";

	return (
		<PostLikeStateProvider
			postId={post.id}
			initialLikes={post.likes}
			initialLiked={post.user_liked}
		>
			<div className="mx-auto w-full px-3 pb-6 pt-0 md:px-5 lg:px-7 xl:px-12 2xl:px-16">
				<PostStickyHeader
					postId={post.id}
					title={post.title}
					authorName={post.author_name}
					createdAt={post.createdAt}
					initialLikes={post.likes}
					initialLiked={post.user_liked}
					commentCount={totalCommentCount}
					backHref={backHref}
				/>
				<div className="mt-4 mb-6 relative">
					{isOwner && (
						<div className="absolute right-0 top-0">
							<Link href={`/posts/${post.id}/edit`} className="btn btn-secondary btn-sm">
								수정
							</Link>
						</div>
					)}

					<div className="mb-6">
						<h1 className="text-2xl md:text-[2rem] font-bold text-text-primary mb-4 leading-[1.3]">
							{post.title}
						</h1>

					{post.board === "ombudsman" && post.serverAddress && (
						<div className="flex flex-wrap gap-2 mb-4">
							<ServerAddressTag address={post.serverAddress} className="bg-bg-secondary text-white hover:bg-bg-tertiary" />
						</div>
					)}

					{post.tags && post.tags.length > 0 && (
						<div className="flex flex-wrap gap-2 mb-4">
							{post.tags.map((tag: string) => (
								<span
									key={tag}
										className="inline-flex items-center rounded px-2 py-[2px] text-[11px] font-semibold bg-bg-secondary text-white"
									>
										{tag}
									</span>
								))}
							</div>
						)}

						<div className="flex items-center gap-3 py-3 border-b border-border">
							<UserAvatar
								uuid={post.author_uuid}
								nickname={post.author_name}
								size={40}
								className="w-10 h-10 rounded-[4px]"
							/>
							<div className="flex-1">
								<div className="font-semibold text-text-primary text-base">{post.author_name}</div>
								<div className="text-[0.85rem] text-text-muted mt-0.5">
									{new Date(post.createdAt).toLocaleString("ko-KR")}
								</div>
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
					<CommentSection
						postId={post.id}
						initialComments={comments}
						initialCommentsPage={commentsPage}
						readMarker={readMarker}
					/>
				</div>
			</div>
		</PostLikeStateProvider>
	);
}
