"use client";

/**
 * 사이드바 설정 모달
 * 링크 순서 변경, 숨기기/표시, 커스텀 링크 CRUD
 *
 * 분할 구조:
 * - SettingsLinkItem.tsx: 개별 링크 행
 * - AddLinkModal.tsx: 커스텀 링크 추가 중첩 모달
 */

import { useState, useEffect, type DragEvent } from "react";
import { X, Plus, RotateCcw } from "lucide-react";
import {
	type SidebarSettings,
	getSidebarSettings,
	saveSidebarSettings,
	resetSidebarSettings,
} from "@/lib/sidebar-settings";
import { type SidebarLink, DEFAULT_LINKS, compareSidebarLinks } from "@/lib/sidebar-links";
import SettingsLinkItem from "./SettingsLinkItem";
import AddLinkModal from "./AddLinkModal";

interface SidebarSettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

interface SidebarSettingsModalContentProps {
	onClose: () => void;
}

/**
 * 모달 초기 상태 구성: 기본 링크 + 커스텀 링크 병합, 중복 제거, 삭제 필터, 순서 정렬
 */
function buildSidebarModalInitialState() {
	const currentSettings = getSidebarSettings();

	// 기본 링크 + 커스텀 링크 병합
	const customItems = (currentSettings.customLinks || []).map((link: SidebarLink) => ({
		...link,
		isCustom: true,
	}));
	const allLinks = [...DEFAULT_LINKS, ...customItems];

	// 중복 ID 제거
	const uniqueLinksMap = new Map<string, SidebarLink>();
	allLinks.forEach((link) => {
		const id = link.id ?? "";
		if (id && !uniqueLinksMap.has(id)) {
			uniqueLinksMap.set(id, link);
		}
	});
	const uniqueLinks = Array.from(uniqueLinksMap.values());

	// 삭제된 항목 필터링
	const filteredLinks = uniqueLinks.filter((link) => !currentSettings.deleted?.includes(link.id ?? ""));

	// 순서 정렬
	if (currentSettings.order && currentSettings.order.length > 0) {
		const orderMap = new Map<string, number>();
		currentSettings.order.forEach((id, index) => {
			orderMap.set(id, index);
		});
		filteredLinks.sort((a, b) => {
			const orderA = orderMap.get(a.id ?? "") ?? 9999;
			const orderB = orderMap.get(b.id ?? "") ?? 9999;
			return orderA - orderB;
		});
	} else {
		filteredLinks.sort(compareSidebarLinks);
	}

	return { settings: currentSettings, items: filteredLinks };
}

export default function SidebarSettingsModal({ isOpen, onClose }: SidebarSettingsModalProps) {
	if (!isOpen) {
		return null;
	}
	return <SidebarSettingsModalContent onClose={onClose} />;
}

function SidebarSettingsModalContent({ onClose }: SidebarSettingsModalContentProps) {
	const [initialState] = useState(buildSidebarModalInitialState);
	const [settings, setSettings] = useState<SidebarSettings>(initialState.settings);
	const [items, setItems] = useState<SidebarLink[]>(initialState.items);
	const [draggedItem, setDraggedItem] = useState<SidebarLink | null>(null);
	const [showAddModal, setShowAddModal] = useState(false);

	// ESC 키로 모달 닫기
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		};
		document.addEventListener("keydown", handleEsc);
		return () => document.removeEventListener("keydown", handleEsc);
	}, [onClose]);

	// --- 드래그 핸들러 ---
	const handleDragStart = (e: DragEvent<HTMLDivElement>, item: SidebarLink) => {
		setDraggedItem(item);
		e.dataTransfer.effectAllowed = "move";
		e.currentTarget.style.opacity = "0.5";
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
		e.preventDefault();
		if (!draggedItem) return;
		const draggedIndex = items.findIndex((i) => i.id === draggedItem.id);
		if (draggedIndex === -1 || draggedIndex === index) return;
		const newItems = [...items];
		newItems.splice(draggedIndex, 1);
		newItems.splice(index, 0, draggedItem);
		setItems(newItems);
	};

	const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
		setDraggedItem(null);
		e.currentTarget.style.opacity = "1";
	};

	// --- 링크 조작 ---
	const toggleVisibility = (linkId: string) => {
		setSettings((prev) => {
			const newHidden = prev.hidden.includes(linkId)
				? prev.hidden.filter((id) => id !== linkId)
				: [...prev.hidden, linkId];
			return { ...prev, hidden: newHidden };
		});
	};

	const handleDeleteLink = (linkId: string, isCustom: boolean) => {
		setItems((prev) => prev.filter((item) => item.id !== linkId));
		setSettings((prev) => {
			const newSettings = { ...prev };
			if (isCustom) {
				newSettings.customLinks = prev.customLinks?.filter((l: SidebarLink) => l.id !== linkId) || [];
			} else {
				newSettings.deleted = [...(prev.deleted || []), linkId];
			}
			newSettings.order = prev.order?.filter((id) => id !== linkId) || [];
			newSettings.hidden = prev.hidden.filter((id) => id !== linkId);
			return newSettings;
		});
	};

	const handleAddLink = (newLink: SidebarLink) => {
		setItems((prev) => [...prev, newLink]);
		setSettings((prev) => ({
			...prev,
			customLinks: [...(prev.customLinks || []), newLink],
		}));
		setShowAddModal(false);
	};

	// --- 저장/초기화 ---
	const handleSave = () => {
		const newSettings: SidebarSettings = {
			...settings,
			order: items.map((item) => item.id!),
		};
		saveSidebarSettings(newSettings);
		window.dispatchEvent(new Event("sidebarSettingsChanged"));
		onClose();
	};

	const handleReset = () => {
		if (!confirm("설정을 초기화하시겠습니까? (커스텀 링크는 삭제되지 않습니다)")) return;
		resetSidebarSettings();
		const resetSettings = getSidebarSettings();
		setSettings(resetSettings);
		window.dispatchEvent(new Event("sidebarSettingsChanged"));
		onClose();
	};

	return (
		<>
			<div className="modal-overlay" onClick={onClose}>
				<div className="modal" onClick={(e) => e.stopPropagation()}>
					{/* 헤더 */}
					<div className="modal-header">
						<h3 className="modal-title">사이드바 설정</h3>
						<button className="modal-close" onClick={onClose}>
							<X size={20} />
						</button>
					</div>

					{/* 콘텐츠 */}
					<div className="modal-content">
						<p className="help-text">
							드래그하여 순서를 변경하거나 눈 아이콘으로 숨길 수 있습니다.
						</p>

						<div className="settings-list">
							{items.map((item, index) => (
								<SettingsLinkItem
									key={item.id}
									item={item}
									index={index}
									isHidden={settings.hidden.includes(item.id!)}
									onDragStart={handleDragStart}
									onDragOver={handleDragOver}
									onDragEnd={handleDragEnd}
									onToggleVisibility={toggleVisibility}
									onDelete={handleDeleteLink}
								/>
							))}
						</div>
					</div>

					{/* 푸터 */}
					<div className="modal-footer">
						<div className="flex-1">
							<button
								className="add-link-btn"
								onClick={() => setShowAddModal(true)}
							>
								<Plus size={16} />
								<span>링크 추가</span>
							</button>
						</div>
						<button className="btn btn-secondary" onClick={handleReset}>
							<RotateCcw size={14} />
							초기화
						</button>
						<button className="btn btn-primary" onClick={handleSave}>
							저장
						</button>
					</div>

					{/* 커스텀 링크 추가 중첩 모달 */}
					{showAddModal && (
						<AddLinkModal
							onClose={() => setShowAddModal(false)}
							onAdd={handleAddLink}
						/>
					)}
				</div>
			</div>

			{/* 스타일 */}
			<style jsx>{`
				.modal-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0, 0, 0, 0.7);
					backdrop-filter: blur(4px);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 9999;
				}

				.modal {
					background: var(--color-bg-primary);
					border-radius: 8px;
					width: 90%;
					max-width: 420px;
					max-height: 85vh;
					display: flex;
					flex-direction: column;
					border: 1px solid var(--color-border);
					box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
					position: relative;
				}

				.modal-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 16px;
					border-bottom: 1px solid var(--color-border);
				}

				.modal-title {
					font-size: 1.1rem;
					font-weight: 600;
					color: white;
				}

				.modal-close {
					background: none;
					border: none;
					color: white;
					cursor: pointer;
					padding: 4px;
					display: flex;
				}

				.modal-close:hover {
					color: var(--color-text-secondary);
				}

				.modal-content {
					flex: 1;
					overflow-y: auto;
					padding: 16px;
					display: flex;
					flex-direction: column;
				}

				.help-text {
					font-size: 0.85rem;
					color: white;
					margin-bottom: 16px;
					flex-shrink: 0;
					opacity: 0.8;
				}

				.settings-list {
					display: flex;
					flex-direction: column;
					gap: 6px;
					flex: 1;
					overflow-y: auto;
					min-height: 200px;
					padding-right: 4px;
				}

				.modal-footer {
					display: flex;
					justify-content: flex-end;
					gap: 8px;
					padding: 16px;
					border-top: 1px solid var(--color-border);
					background: var(--color-bg-tertiary);
					border-bottom-left-radius: 8px;
					border-bottom-right-radius: 8px;
				}

				.add-link-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 6px;
					padding: 8px 12px;
					background: transparent;
					border: 1px dashed var(--color-border);
					border-radius: 4px;
					color: var(--color-text-muted);
					cursor: pointer;
					font-size: 0.85rem;
					transition: all 0.2s;
					height: 100%;
				}

				.add-link-btn:hover {
					background: var(--color-bg-tertiary);
					color: var(--color-text-primary);
					border-color: var(--color-text-muted);
				}

				/* 스크롤바 커스텀 */
				.settings-list::-webkit-scrollbar {
					width: 6px;
				}
				.settings-list::-webkit-scrollbar-track {
					background: transparent;
				}
				.settings-list::-webkit-scrollbar-thumb {
					background: var(--color-border);
					border-radius: 3px;
				}
				.settings-list::-webkit-scrollbar-thumb:hover {
					background: var(--color-text-muted);
				}
			`}</style>
		</>
	);
}
