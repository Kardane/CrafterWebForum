import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PostContent from "@/components/posts/PostContent";
import LikeButton from "@/components/posts/LikeButton";
import CommentSection from "@/components/comments/CommentSection";
import { MessageCircle, Eye, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PostDetailPageProps {
	params: Promise<{ id: string }>;
}

async function getPostDetail(id: string) {
	const res = await fetch(`${process.env.NEXTAUTH_URL}/api/posts/${id}`, {
		cache: "no-store"
	});

	if (!res.ok) {
		return null;
	}

	return res.json();
}

/**
 * 마인크래프트 헤드 이미지 URL
 */
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

	if (!data || !data.post) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[400px] text-center">
				<h2 className="text-2xl font-bold mb-4">게시글을 찾을 수 없습니다</h2>
				<p className="text-text-secondary mb-6">
					삭제되었거나 존재하지 않는 게시글입니다.
				</p>
				<Link href="/" className="btn btn-primary">
					목록으로 돌아가기
				</Link>
			</div>
		);
	}

	const { post, comments } = data;
	const isOwner = session.user.id === post.author_id;

	return (
		<div className="max-w-4xl mx-auto p-6">
			{/* 상단 네비게이션 */}
			<div className="flex items-center justify-between mb-6">
				<Link href="/" className="btn btn-secondary btn-sm">
					<ArrowLeft size={16} />
					목록
				</Link>
				{isOwner && (
					<Link
						href={`/posts/${post.id}/edit`}
						className="btn btn-secondary btn-sm"
					>
						수정
					</Link>
				)}
			</div>

			{/* 포스트 헤더 */}
			<div className="post-header">
				<h1 className="post-title">{post.title}</h1>

				{/* 태그 */}
				{post.tags && post.tags.length > 0 && (
					<div className="post-tags">
						{post.tags.map((tag: string) => (
							<span key={tag} className="tag">
								{tag}
							</span>
						))}
					</div>
				)}

				{/* 작성자 정보 */}
				<div className="post-author">
					{post.author_uuid ? (
						<img
							src={getMinecraftHeadUrl(post.author_uuid, 40) || ""}
							alt=""
							className="author-avatar"
						/>
					) : (
						<div className="author-avatar-fallback">
							{post.author_name[0].toUpperCase()}
						</div>
					)}
					<div className="author-info">
						<div className="author-name">{post.author_name}</div>
						<div className="post-meta">
							{new Date(post.createdAt).toLocaleString("ko-KR")}
						</div>
					</div>
				</div>
			</div>

			{/* 포스트 본문 */}
			<div className="post-body">
				<PostContent content={post.content} />
			</div>

			{/* 통계 및 액션 */}
			<div className="post-actions">
				<LikeButton
					postId={post.id}
					initialLikes={post.likes}
					initialLiked={post.user_liked}
				/>
				<div className="post-stat">
					<MessageCircle size={16} />
					<span>{comments.length}</span>
				</div>
				<div className="post-stat">
					<Eye size={16} />
					<span>{post.views}</span>
				</div>
			</div>

			{/* 댓글 섹션 */}
			<div className="mt-8">
				<CommentSection postId={post.id} initialComments={comments} />
			</div>

			{/* 스타일 */}
			<style jsx>{`
				.post-header {
					margin-bottom: 24px;
				}

				.post-title {
					font-size: 2rem;
					font-weight: 700;
					color: var(--text-primary);
					margin-bottom: 16px;
					line-height: 1.3;
				}

				.post-tags {
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
					margin-bottom: 16px;
				}

				.post-author {
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 12px 0;
					border-bottom: 1px solid var(--border);
				}

				.author-avatar {
					width: 40px;
					height: 40px;
					border-radius: 50%;
					image-rendering: pixelated;
				}

				.author-avatar-fallback {
					width: 40px;
					height: 40px;
					border-radius: 50%;
					background: var(--bg-tertiary);
					display: flex;
					align-items: center;
					justify-content: center;
					font-weight: 600;
					color: var(--text-muted);
				}

				.author-info {
					flex: 1;
				}

				.author-name {
					font-weight: 600;
					color: var(--text-primary);
					font-size: 1rem;
				}

				.post-meta {
					font-size: 0.85rem;
					color: var(--text-muted);
					margin-top: 2px;
				}

				.post-body {
					background: var(--bg-secondary);
					border-radius: 8px;
					padding: 24px;
					margin: 24px 0;
					min-height: 200px;
				}

				.post-actions {
					display: flex;
					align-items: center;
					gap: 16px;
					padding: 16px 0;
					border-bottom: 1px solid var(--border);
					margin-bottom: 24px;
				}

				.post-stat {
					display: flex;
					align-items: center;
					gap: 6px;
					color: var(--text-secondary);
					font-size: 0.9rem;
				}

				@media (max-width: 768px) {
					.post-title {
						font-size: 1.5rem;
					}

					.post-body {
						padding: 16px;
					}
				}
			`}</style>
		</div>
	);
}
