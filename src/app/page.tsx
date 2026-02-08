import Link from "next/link";
import PostFilters from "@/components/posts/PostFilters";
import PostList from "@/components/posts/PostList";

// API Base URL 유틸리티
const getBaseUrl = () => {
	if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
	return 'http://localhost:3000';
};

async function getPosts(searchParams: { page?: string, limit?: string, tag?: string, sort?: string, search?: string }) {
	const params = new URLSearchParams();
	if (searchParams.page) params.set("page", searchParams.page);
	if (searchParams.limit) params.set("limit", searchParams.limit);
	if (searchParams.tag) params.set("tag", searchParams.tag);
	if (searchParams.sort) params.set("sort", searchParams.sort);
	if (searchParams.search) params.set("search", searchParams.search);

	const res = await fetch(`${getBaseUrl()}/api/posts?${params.toString()}`, {
		cache: 'no-store', // 실시간 데이터 중요
	});

	if (!res.ok) {
		throw new Error('Failed to fetch posts');
	}

	return res.json();
}

interface PageProps {
	searchParams: Promise<{ [key: string]: string | undefined }>; // Next.js 15+ searchParams is async
}

// Next.js 15 type compatibility
export default async function Home(props: PageProps) {
	const searchParams = await props.searchParams;
	let data;
	try {
		data = await getPosts(searchParams);
	} catch (e) {
		console.error("Failed to load posts:", e);
		data = { posts: [], metadata: { total: 0, totalPages: 0, page: 1 } };
	}

	return (
		<div className="max-w-4xl mx-auto">
			{/* 필터 및 검색 (여기에 새 포스트 버튼 포함됨) */}

			{/* 필터 및 검색 */}
			<PostFilters />

			{/* 게시글 목록 */}
			<div className="relative min-h-[500px]">
				<div className="absolute right-0 top-[-40px] text-sm text-text-muted font-medium">
					총 {data.metadata.total?.toLocaleString()}개 포스트
				</div>
				<PostList
					posts={data.posts || []}
					totalPages={data.metadata.totalPages || 0}
					currentPage={Number(data.metadata.page || 1)}
				/>
			</div>
		</div>
	);
}
