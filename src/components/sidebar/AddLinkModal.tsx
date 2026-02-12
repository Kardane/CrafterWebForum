"use client";

/**
 * 사이드바 설정 - 커스텀 링크 추가 모달 (중첩)
 */

import { useState } from "react";
import { normalizeSidebarUrl, getFaviconUrl } from "@/lib/sidebar-settings";
import type { SidebarLink } from "@/lib/sidebar-links";

interface AddLinkModalProps {
	onClose: () => void;
	onAdd: (link: SidebarLink) => void;
}

export default function AddLinkModal({ onClose, onAdd }: AddLinkModalProps) {
	const [title, setTitle] = useState("");
	const [url, setUrl] = useState("");

	const handleAdd = () => {
		if (!title.trim()) {
			alert("제목을 입력해주세요");
			return;
		}
		if (!url.trim()) {
			alert("URL을 입력해주세요");
			return;
		}

		const normalizedUrl = normalizeSidebarUrl(url);
		if (!normalizedUrl) {
			alert("올바른 URL 형식이 아닙니다");
			return;
		}

		const newLink: SidebarLink = {
			id: `custom_${Date.now()}`,
			title: title.trim(),
			url: normalizedUrl,
			icon_url: getFaviconUrl(normalizedUrl),
			category: "Custom",
			sort_order: 9999,
			isCustom: true,
		};

		onAdd(newLink);
	};

	return (
		<>
			<div className="add-modal-overlay">
				<div className="add-modal">
					<h4 className="add-modal-title">새 링크 추가</h4>
					<input
						type="text"
						placeholder="제목 (예: 마인크래프트 위키)"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="add-link-input"
						autoFocus
					/>
					<input
						type="text"
						placeholder="URL (예: https://minecraft.wiki)"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						className="add-link-input"
					/>
					<div className="add-modal-actions">
						<button className="btn btn-secondary flex-1" onClick={onClose}>
							취소
						</button>
						<button className="btn btn-primary flex-1" onClick={handleAdd}>
							추가
						</button>
					</div>
				</div>
			</div>

			<style jsx>{`
				.add-modal-overlay {
					position: absolute;
					inset: 0;
					background: rgba(0, 0, 0, 0.6);
					backdrop-filter: blur(2px);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 10;
					border-radius: 8px;
				}
				.add-modal {
					background: var(--color-bg-tertiary);
					padding: 16px;
					border-radius: 8px;
					width: 85%;
					border: 1px solid var(--color-border);
					display: flex;
					flex-direction: column;
					gap: 10px;
					box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
				}
				.add-modal-title {
					font-size: 1rem;
					font-weight: 600;
					color: white;
					margin-bottom: 4px;
				}
				.add-link-input {
					padding: 8px 12px;
					background: var(--color-bg-secondary);
					border: 1px solid var(--color-border);
					border-radius: 4px;
					color: var(--color-text-primary);
					font-size: 0.9rem;
				}
				.add-link-input:focus {
					outline: none;
					border-color: var(--color-accent);
				}
				.add-modal-actions {
					display: flex;
					gap: 8px;
					margin-top: 4px;
				}
			`}</style>
		</>
	);
}
