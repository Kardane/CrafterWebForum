import PostFilters from "@/components/posts/PostFilters";
import PostList from "@/components/posts/PostList";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function getPosts(
	searchParams: { limit?: string, tag?: string, sort?: string, search?: string },
	options: { baseUrl: string; cookieHeader: string | null }
) {
	const params = new URLSearchParams();
	params.set("page", "1");
	if (searchParams.limit) params.set("limit", searchParams.limit);
	if (searchParams.tag) params.set("tag", searchParams.tag);
	if (searchParams.sort) params.set("sort", searchParams.sort);
	if (searchParams.search) params.set("search", searchParams.search);

	const res = await fetch(`${options.baseUrl}/api/posts?${params.toString()}`, {
		cache: 'no-store', // 실시간 데이터 중요
		headers: options.cookieHeader ? { cookie: options.cookieHeader } : undefined,
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
	const session = await auth();
	if (!session?.user) {
		redirect("/login?callbackUrl=/");
	}
	const requestHeaders = await headers();
	const host =
		requestHeaders.get("x-forwarded-host") ??
		requestHeaders.get("host") ??
		null;
	const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
	const baseUrl = host
		? `${protocol}://${host}`
		: process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000";
	const cookieHeader = requestHeaders.get("cookie");

	const searchParams = await props.searchParams;
	let data;
	try {
		data = await getPosts(searchParams, { baseUrl, cookieHeader });
	} catch (e) {
		console.error("Failed to load posts:", e);
		data = { posts: [], metadata: { total: 0, totalPages: 0, page: 1 } };
	}

	return (
		<div className="max-w-4xl mx-auto">
			{/* 필터 및 검색 (총 포스트 수 포함) */}
			<PostFilters totalPosts={Number(data.metadata.total ?? 0)} />

			<div className="min-h-[500px]">
				<PostList
					initialPosts={data.posts || []}
					totalPages={data.metadata.totalPages || 0}
					initialPage={Number(data.metadata.page || 1)}
					initialLimit={Number(data.metadata.limit || 12)}
				/>
			</div>
		</div>
	);
}
