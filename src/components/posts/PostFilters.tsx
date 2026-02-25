"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import classNames from "classnames";
import { POST_TAGS } from "@/constants/post-tags";
import Link from "next/link";
import { Plus } from "lucide-react";
import { text } from "@/lib/system-text";

const SORT_OPTIONS = [
	{ value: "activity", label: text("postFilters.sortActivity") },
	{ value: "newest", label: text("postFilters.sortNewest") },
	{ value: "oldest", label: text("postFilters.sortOldest") },
	{ value: "likes", label: text("postFilters.sortLikes") },
	{ value: "comments", label: text("postFilters.sortComments") },
];

interface PostFiltersProps {
	totalPosts?: number;
	board?: "forum" | "ombudsman";
}

export default function PostFilters({ totalPosts = 0, board = "forum" }: PostFiltersProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const currentTag = searchParams.get("tag") || "";
	const currentSort = searchParams.get("sort") || "activity";
	const currentSearch = searchParams.get("search") || "";

	const [searchTerm, setSearchTerm] = useState(currentSearch);
	const [isTagsOpen, setIsTagsOpen] = useState(false);

	// URL 파라미터 업데이트 함수
	const updateParams = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("board", board);
		if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		// 무한 스크롤 기준으로 필터가 바뀌면 페이지 파라미터는 제거
		if (key !== "page") {
			params.delete("page");
		}
		router.push(`${pathname}?${params.toString()}`);
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		updateParams("search", searchTerm);
	};

	return (
		<div className="mb-3 flex flex-col gap-3">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				{/* 좌측: 새 포스트 + 검색 */}
				<div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:flex-1">
						<Link
							href={board === "ombudsman" ? "/ombudsman/new" : "/posts/new"}
							className="btn btn-primary h-9 gap-2 px-3 whitespace-nowrap"
						>
							<Plus size={18} />
							<span>{board === "ombudsman" ? "서버 포스트 작성" : text("postFilters.newPost")}</span>
						</Link>

					<form
						onSubmit={handleSearch}
						className="flex w-full min-w-0 flex-1 sm:max-w-[720px]"
					>
						<input
							placeholder={text("postFilters.searchPlaceholder")}
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="input-base h-9 min-w-0 flex-1 rounded-r-none border-r-0"
						/>
						<button
							type="submit"
							className="h-9 flex-shrink-0 rounded-l-none rounded-r-md bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
						>
							{text("postFilters.searchButton")}
						</button>
					</form>
				</div>

				{/* 우측: 정렬 + 태그 + 총 포스트 */}
				<div className="flex w-full flex-wrap items-center justify-between gap-2 lg:w-auto lg:justify-end">
					<div className="flex items-center gap-2">
						<div className="relative">
							<select
								value={currentSort}
								onChange={(e) => updateParams("sort", e.target.value)}
								className="input-base h-9 cursor-pointer appearance-none bg-bg-secondary pl-3 pr-8"
							>
								{SORT_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
							{/* 커스텀 화살표 */}
							<div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted">
								<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</div>
						</div>

						{board === "forum" && (
							<button
								onClick={() => setIsTagsOpen(!isTagsOpen)}
								className={classNames(
									"h-9 rounded-md border px-4 text-sm font-medium transition-colors flex items-center gap-2",
									isTagsOpen
										? "bg-bg-secondary border-text-muted text-text-primary"
										: "bg-bg-tertiary border-border text-text-secondary hover:bg-bg-secondary"
								)}
							>
								{text("postFilters.tagsButton")}
								<span className="text-[10px]">{isTagsOpen ? "▲" : "▼"}</span>
							</button>
						)}
					</div>
					<div className="text-sm font-medium text-text-muted whitespace-nowrap">
						{text("postFilters.totalPosts", { count: totalPosts.toLocaleString() })}
					</div>
				</div>
			</div>

			{/* 태그 목록 */}
			{board === "forum" && (
			<div
				className={classNames(
					"flex flex-wrap gap-2 overflow-hidden transition-all duration-300",
					isTagsOpen ? "opacity-100 max-h-40" : "opacity-0 max-h-0"
				)}
			>
				<button
					onClick={() => updateParams("tag", "")}
					className={classNames(
						"px-2 py-1 rounded-xl text-xs font-medium transition-colors border",
						!currentTag
							? "bg-accent text-white border-accent"
							: "bg-bg-tertiary text-text-secondary border-transparent hover:bg-bg-secondary"
					)}
				>
					{text("postFilters.allTag")}
				</button>
				{POST_TAGS.map(tag => (
					<button
						key={tag}
						onClick={() => updateParams("tag", currentTag === tag ? "" : tag)}
						className={classNames(
							"px-2 py-1 rounded-xl text-xs font-medium transition-colors border cursor-pointer",
							currentTag === tag
								? "bg-accent text-white border-accent"
								: "bg-bg-tertiary text-text-secondary border-transparent hover:bg-bg-secondary"
						)}
					>
						{tag}
					</button>
				))}
			</div>
			)}
		</div>
	);
}
