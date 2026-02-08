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
			<div className="mb-6">
				<h1 className="text-2xl md:text-[2rem] font-bold text-text-primary mb-4 leading-[1.3]">
					{post.title}
				</h1>

				{/* 태그 */}
				{post.tags && post.tags.length > 0 && (
					<div className="flex flex-wrap gap-2 mb-4">
						{post.tags.map((tag: string) => (
							<span key={tag} className="tag">
								{tag}
							</span>
						))}
					</div>
				)}

				{/* 작성자 정보 */}
				<div className="flex items-center gap-3 py-3 border-b border-border">
					{post.author_uuid ? (
						<img
							src={getMinecraftHeadUrl(post.author_uuid, 40) || ""}
							alt=""
							className="w-10 h-10 rounded-full [image-rendering:pixelated]"
						/>
					) : (
						<div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center font-semibold text-text-muted">
							{post.author_name[0].toUpperCase()}
						</div>
					)}
					<div className="flex-1">
						<div className="font-semibold text-text-primary text-base">
							{post.author_name}
						</div>
						<div className="text-[0.85rem] text-text-muted mt-0.5">
							{new Date(post.createdAt).toLocaleString("ko-KR")}
						</div>
					</div>
				</div>
			</div>

			{/* 포스트 본문 */}
			<div className="bg-bg-secondary rounded-lg p-6 my-6 min-h-[200px] max-md:p-4">
				<PostContent content={post.content} />
			</div>

			{/* 통계 및 액션 */}
			<div className="flex items-center gap-4 py-4 border-b border-border mb-6">
				<LikeButton
					postId={post.id}
					initialLikes={post.likes}
					initialLiked={post.user_liked}
				/>
				<div className="flex items-center gap-1.5 text-text-secondary text-[0.9rem]">
					<MessageCircle size={16} />
					<span>{comments.length}</span>
				</div>
				<div className="flex items-center gap-1.5 text-text-secondary text-[0.9rem]">
					<Eye size={16} />
					<span>{post.views}</span>
				</div>
			</div>

			{/* 댓글 섹션 */}
			<div className="mt-8">
				<CommentSection postId={post.id} initialComments={comments} />
			</div>

			{/* 스타일 */}
		</div>
	);
}
