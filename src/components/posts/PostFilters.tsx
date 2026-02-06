"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import classNames from "classnames";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

// TODO: API로 가져오도록 변경 가능
const AVAILABLE_TAGS = [
	"플러그인", "모드", "데이터팩", "리소스팩", "Skript", "질문", "공유", "토론"
];

const SORT_OPTIONS = [
	{ value: "newest", label: "최신순" },
	{ value: "oldest", label: "오래된순" },
	{ value: "likes", label: "추천순" },
	{ value: "comments", label: "댓글순" },
	{ value: "activity", label: "최근 활동순" },
];

export default function PostFilters() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const currentTag = searchParams.get("tag") || "";
	const currentSort = searchParams.get("sort") || "newest";
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
		<div className="flex flex-col gap-4 mb-6">
			<div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
				{/* 새 포스트 버튼 위치 (Page 레벨에서 처리할 수 있으나 레이아웃상 여기도 가능) */}

				<div className="flex-1 w-full sm:w-auto flex gap-2">
					<form onSubmit={handleSearch} className="flex-1 max-w-sm relative">
						<Input
							placeholder="포스트 검색..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pr-10"
						/>
						<button
							type="submit"
							className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
						>
							<Search size={18} />
						</button>
					</form>
				</div>

				<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
					<select
						value={currentSort}
						onChange={(e) => updateParams("sort", e.target.value)}
						className="h-10 rounded-md border border-border bg-bg-secondary px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
					>
						{SORT_OPTIONS.map(opt => (
							<option key={opt.value} value={opt.value}>{opt.label}</option>
						))}
					</select>

					<button
						onClick={() => setIsTagsOpen(!isTagsOpen)}
						className="h-10 px-4 rounded-md bg-bg-tertiary border border-border text-sm font-medium hover:bg-bg-secondary transition-colors whitespace-nowrap"
					>
						태그 {isTagsOpen ? "▲" : "▼"}
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
						onClick={() => updateParams("tag", tag)}
						className={classNames(
							"px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border",
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
