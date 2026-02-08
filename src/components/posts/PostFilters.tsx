"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import classNames from "classnames";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

// TODO: API로 가져오도록 변경 가능
const AVAILABLE_TAGS = [
	"질문", "플러그인", "Skript", "모드", "모드팩", "데이터팩", "리소스팩",
	"프로그램", "바닐라", "장타서버", "단타서버", "해드립니다", "기타"
];

const SORT_OPTIONS = [
	{ value: "activity", label: "최근 활동순" },
	{ value: "newest", label: "최신순" },
	{ value: "oldest", label: "오래된순" },
	{ value: "likes", label: "추천순" },
	{ value: "comments", label: "댓글순" },
];

import Link from "next/link";
import { Plus } from "lucide-react";

export default function PostFilters() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const currentTag = searchParams.get("tag") || "";
	const currentSort = searchParams.get("sort") || "activity";
	const currentSearch = searchParams.get("search") || "";

	const [searchTerm, setSearchTerm] = useState(currentSearch);
	const [isTagsOpen, setIsTagsOpen] = useState(false);

	// URL 파라미터 업데이트 함수
	const updateParams = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		// 필터 변경 시 페이지를 1로 초기화
		if (key !== "page") {
			params.set("page", "1");
		}
		router.push(`/?${params.toString()}`);
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		updateParams("search", searchTerm);
	};

	return (
		<div className="flex flex-col gap-4 mb-2">
			<div className="flex flex-col md:flex-row gap-2 justify-between items-start md:items-center">
				{/* 좌측: 새 포스트 + 검색창 */}
				<div className="flex w-full md:w-auto gap-2">
					<Link
						href="/posts/new"
						className="btn btn-primary flex items-center gap-2 px-4 whitespace-nowrap shadow-md hover:shadow-lg transition-shadow"
					>
						<Plus size={18} />
						<span className="hidden sm:inline">새 포스트</span>
						<span className="sm:hidden">작성</span>
					</Link>

					<form onSubmit={handleSearch} className="flex-1 flex w-full md:max-w-md">
						<Input
							placeholder="포스트 검색..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="rounded-l-md rounded-r-none border-r-0 focus:ring-0 flex-1 min-w-0"
						/>
						<button
							type="submit"
							className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-r-md font-medium text-sm transition-colors w-24 flex-shrink-0"
						>
							검색
						</button>
					</form>
				</div>

				{/* 우측: 정렬 + 태그 */}
				<div className="flex gap-2 w-full md:w-auto justify-end">
					<div className="relative">
						<select
							value={currentSort}
							onChange={(e) => updateParams("sort", e.target.value)}
							className="appearance-none h-10 pl-3 pr-8 rounded-md border border-border bg-bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
						>
							{SORT_OPTIONS.map(opt => (
								<option key={opt.value} value={opt.value}>{opt.label}</option>
							))}
						</select>
						{/* 커스텀 화살표 */}
						<div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
							<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</div>
					</div>

					<button
						onClick={() => setIsTagsOpen(!isTagsOpen)}
						className={classNames(
							"h-10 px-4 rounded-md border text-sm font-medium transition-colors flex items-center gap-2",
							isTagsOpen
								? "bg-bg-secondary border-text-muted text-text-primary"
								: "bg-bg-tertiary border-border text-text-secondary hover:bg-bg-secondary"
						)}
					>
						태그
						<span className="text-[10px]">{isTagsOpen ? "▲" : "▼"}</span>
					</button>
				</div>
			</div>

			{/* 태그 목록 */}
			<div
				className={classNames(
					"flex flex-wrap gap-2 overflow-hidden transition-all duration-300",
					isTagsOpen ? "opacity-100 max-h-40" : "opacity-0 max-h-0"
				)}
			>
				<button
					onClick={() => updateParams("tag", "")}
					className={classNames(
						"px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border",
						!currentTag
							? "bg-accent text-white border-accent"
							: "bg-bg-tertiary text-text-secondary border-transparent hover:bg-bg-secondary"
					)}
				>
					전체
				</button>
				{AVAILABLE_TAGS.map(tag => (
					<button
						key={tag}
						onClick={() => updateParams("tag", currentTag === tag ? "" : tag)}
						className={classNames(
							"px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border cursor-pointer",
							currentTag === tag
								? "bg-accent text-white border-accent"
								: "bg-bg-tertiary text-text-secondary border-transparent hover:bg-bg-secondary"
						)}
					>
						{tag}
					</button>
				))}
			</div>
		</div>
	);
}
