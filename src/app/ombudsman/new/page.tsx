"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ComposerPageLayout from "@/components/editor/ComposerPageLayout";
import { useToast } from "@/components/ui/useToast";
import { parseServerAddress } from "@/lib/server-address";

export default function OmbudsmanNewPage() {
	const router = useRouter();
	const { data: session } = useSession();
	const { showToast } = useToast();

	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [serverAddress, setServerAddress] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const parsedAddress = useMemo(() => parseServerAddress(serverAddress), [serverAddress]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!title.trim() || !content.trim()) {
			showToast({ type: "error", message: "제목과 내용을 입력해줘" });
			return;
		}
		if (!session?.user) {
			showToast({ type: "error", message: "로그인이 필요함" });
			return;
		}
		if (!parsedAddress) {
			showToast({ type: "error", message: "서버 주소 형식이 올바르지 않음 (예: mc.example.com:25565)" });
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					content,
					board: "ombudsman",
					serverAddress: parsedAddress.normalizedAddress,
				}),
			});
			const payload = (await response.json()) as { postId?: number; error?: string };
			if (!response.ok || !payload.postId) {
				throw new Error(payload.error || "신문고 글 작성 실패");
			}
			showToast({ type: "success", message: "신문고 글 작성 완료" });
			router.push(`/posts/${payload.postId}`);
		} catch (error) {
			console.error("Create ombudsman post failed:", error);
			showToast({
				type: "error",
				message: error instanceof Error ? error.message : "신문고 글 작성 실패",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<ComposerPageLayout title="서버 신문고 글 작성" description="서버 주소 형식을 확인한 뒤 등록됨" backHref="/ombudsman" backLabel="신문고 목록으로">
			<form onSubmit={handleSubmit} className="flex flex-col gap-5">
				<div className="space-y-2">
					<label htmlFor="ombudsman-title" className="text-sm font-semibold text-text-secondary">
						제목
					</label>
					<input
						id="ombudsman-title"
						type="text"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						className="input-base"
						maxLength={100}
						required
					/>
				</div>

				<div className="space-y-2">
					<label htmlFor="ombudsman-server" className="text-sm font-semibold text-text-secondary">
						서버 주소 (host:port)
					</label>
					<input
						id="ombudsman-server"
						type="text"
						value={serverAddress}
						onChange={(event) => setServerAddress(event.target.value)}
						className="input-base"
						placeholder="예: mc.example.com:25565"
						required
					/>
					{serverAddress.trim().length > 0 && !parsedAddress && (
						<p className="text-xs text-error">서버 주소 형식이 올바르지 않음 (예: mc.example.com:25565)</p>
					)}
				</div>

				<div className="space-y-2">
					<label htmlFor="ombudsman-content" className="text-sm font-semibold text-text-secondary">
						내용
					</label>
					<textarea
						id="ombudsman-content"
						value={content}
						onChange={(event) => setContent(event.target.value)}
						className="input-base min-h-[320px] resize-y py-3"
						placeholder="서버 관련 제보/문의 내용을 입력"
						required
					/>
				</div>

				<div className="mt-1 flex items-center justify-end gap-2 border-t border-border pt-4">
					<button type="button" onClick={() => router.push("/ombudsman")} className="btn btn-secondary">
						취소
					</button>
					<button type="submit" disabled={isSubmitting} className="btn btn-primary">
						{isSubmitting ? "작성 중" : "신문고 등록"}
					</button>
				</div>
			</form>
		</ComposerPageLayout>
	);
}
