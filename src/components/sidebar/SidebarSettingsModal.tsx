"use client";

import { useState, useEffect, DragEvent } from "react";
import { X, GripVertical, Plus, Trash2, Eye, EyeOff, RotateCcw } from "lucide-react";
import {
	SidebarLink,
	SidebarSettings,
	getSidebarSettings,
	saveSidebarSettings,
	resetSidebarSettings,
	getFaviconUrl
} from "@/lib/sidebar-settings";

interface SidebarSettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
	defaultLinks: SidebarLink[];
	onSave: () => void;
}

/**
 * 사이드바 설정 모달 - 레거시 스타일
 * - 드래그 정렬
 * - 링크 숨기기/표시
 * - 커스텀 링크 추가/편집/삭제
 */
export default function SidebarSettingsModal({
	isOpen,
	onClose,
	defaultLinks,
	onSave
}: SidebarSettingsModalProps) {
	const [settings, setSettings] = useState<SidebarSettings>(getSidebarSettings());
	const [items, setItems] = useState<SidebarLink[]>([]);
	const [draggedItem, setDraggedItem] = useState<SidebarLink | null>(null);
	const [isAddingLink, setIsAddingLink] = useState(false);
	const [newLinkTitle, setNewLinkTitle] = useState("");
	const [newLinkUrl, setNewLinkUrl] = useState("");

	// 아이템 목록 초기화
	useEffect(() => {
		if (isOpen) {
			const currentSettings = getSidebarSettings();
			setSettings(currentSettings);

			// 기본 링크 + 커스텀 링크 병합
			const allLinks = [
				...defaultLinks.map((l) => ({ ...l, isCustom: false })),
				...currentSettings.customLinks
			];

			// 순서 정렬
			if (currentSettings.order.length > 0) {
				const orderMap: Record<string, number> = {};
				currentSettings.order.forEach((id, index) => {
					orderMap[id] = index;
				});
				allLinks.sort((a, b) => {
					const orderA = orderMap[a.id] !== undefined ? orderMap[a.id] : 9999;
					const orderB = orderMap[b.id] !== undefined ? orderMap[b.id] : 9999;
					return orderA - orderB;
				});
			}

			setItems(allLinks);
		}
	}, [isOpen, defaultLinks]);

	// 드래그 핸들러
	const handleDragStart = (e: DragEvent<HTMLDivElement>, item: SidebarLink) => {
		setDraggedItem(item);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
		e.preventDefault();
		if (!draggedItem) return;

		const draggedIndex = items.indexOf(draggedItem);
		if (draggedIndex === index) return;

		const newItems = [...items];
		newItems.splice(draggedIndex, 1);
		newItems.splice(index, 0, draggedItem);
		setItems(newItems);
	};

	const handleDragEnd = () => {
		setDraggedItem(null);
	};

	// 링크 숨기기/표시 토글
	const toggleVisibility = (linkId: string) => {
		setSettings((prev) => {
			const newHidden = prev.hidden.includes(linkId)
				? prev.hidden.filter((id) => id !== linkId)
				: [...prev.hidden, linkId];
			return { ...prev, hidden: newHidden };
		});
	};

	// 커스텀 링크 삭제
	const deleteCustomLink = (linkId: string) => {
		if (!confirm("정말 삭제하시겠습니까?")) return;

		setItems((prev) => prev.filter((item) => item.id !== linkId));
		setSettings((prev) => ({
			...prev,
			customLinks: prev.customLinks.filter((l) => l.id !== linkId),
			order: prev.order.filter((id) => id !== linkId),
			hidden: prev.hidden.filter((id) => id !== linkId)
		}));
	};

	// 링크 추가
	const addLink = () => {
		if (!newLinkTitle.trim()) {
			alert("제목을 입력해주세요");
			return;
		}
		if (!newLinkUrl.trim()) {
			alert("URL을 입력해주세요");
			return;
		}

		const newLink: SidebarLink = {
			id: `custom_${Date.now()}`,
			title: newLinkTitle.trim(),
			url: newLinkUrl.trim(),
			icon_url: getFaviconUrl(newLinkUrl),
			isCustom: true
		};

		setItems((prev) => [...prev, newLink]);
		setSettings((prev) => ({
			...prev,
			customLinks: [...prev.customLinks, newLink]
		}));

		setNewLinkTitle("");
		setNewLinkUrl("");
		setIsAddingLink(false);
	};

	// 저장
	const handleSave = () => {
		const newSettings: SidebarSettings = {
			...settings,
			order: items.map((item) => item.id)
		};

		saveSidebarSettings(newSettings);
		onSave();
		onClose();
	};

	// 초기화
	const handleReset = () => {
		if (!confirm("설정을 초기화하시겠습니까?")) return;

		resetSidebarSettings();
		setSettings(getSidebarSettings());
		setItems([...defaultLinks.map((l) => ({ ...l, isCustom: false }))]);
	};

	if (!isOpen) return null;

	return (
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

					{/* 아이템 목록 */}
					<div className="settings-list">
						{items.map((item, index) => {
							const isHidden = settings.hidden.includes(item.id);

							return (
								<div
									key={item.id}
									className={`settings-item ${isHidden ? "hidden-item" : ""}`}
									draggable
									onDragStart={(e) => handleDragStart(e, item)}
									onDragOver={(e) => handleDragOver(e, index)}
									onDragEnd={handleDragEnd}
								>
									{/* 드래그 핸들 */}
									<div className="drag-handle">
										<GripVertical size={16} />
									</div>

									{/* 아이콘 */}
									{item.icon_url && (
										<img src={item.icon_url} alt="" className="item-icon" />
									)}

									{/* 제목 */}
									<div className="item-title">{item.title}</div>

									{/* 액션 버튼 */}
									<div className="item-actions">
										<button
											className="action-btn"
											onClick={() => toggleVisibility(item.id)}
											title={isHidden ? "표시" : "숨기기"}
										>
											{isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
										</button>

										{item.isCustom && (
											<button
												className="action-btn danger"
												onClick={() => deleteCustomLink(item.id)}
												title="삭제"
											>
												<Trash2 size={16} />
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>

					{/* 링크 추가 */}
					{isAddingLink ? (
						<div className="add-link-form">
							<input
								type="text"
								placeholder="제목"
								value={newLinkTitle}
								onChange={(e) => setNewLinkTitle(e.target.value)}
								className="add-link-input"
							/>
							<input
								type="text"
								placeholder="URL (https://...)"
								value={newLinkUrl}
								onChange={(e) => setNewLinkUrl(e.target.value)}
								className="add-link-input"
							/>
							<div className="add-link-actions">
								<button className="btn btn-primary btn-sm" onClick={addLink}>
									추가
								</button>
								<button
									className="btn btn-secondary btn-sm"
									onClick={() => setIsAddingLink(false)}
								>
									취소
								</button>
							</div>
						</div>
					) : (
						<button
							className="add-link-btn"
							onClick={() => setIsAddingLink(true)}
						>
							<Plus size={16} />
							링크 추가
						</button>
					)}
				</div>

				{/* 푸터 */}
				<div className="modal-footer">
					<button className="btn btn-secondary" onClick={handleReset}>
						<RotateCcw size={14} />
						초기화
					</button>
					<button className="btn btn-primary" onClick={handleSave}>
						저장
					</button>
				</div>
			</div>

			{/* 스타일 */}
			<style jsx>{`
				.modal-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0, 0, 0, 0.7);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 9999;
				}

				.modal {
					background: var(--bg-secondary);
					border-radius: 8px;
					width: 90%;
					max-width: 400px;
					max-height: 80vh;
					display: flex;
					flex-direction: column;
				}

				.modal-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 16px;
					border-bottom: 1px solid var(--border);
				}

				.modal-title {
					font-size: 1.1rem;
					font-weight: 600;
					color: var(--text-primary);
				}

				.modal-close {
					background: none;
					border: none;
					color: var(--text-muted);
					cursor: pointer;
					padding: 4px;
				}

				.modal-close:hover {
					color: var(--text-primary);
				}

				.modal-content {
					flex: 1;
					overflow-y: auto;
					padding: 16px;
				}

				.help-text {
					font-size: 0.85rem;
					color: var(--text-muted);
					margin-bottom: 16px;
				}

				.settings-list {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}

				.settings-item {
					display: flex;
					align-items: center;
					gap: 8px;
					padding: 8px;
					background: var(--bg-tertiary);
					border-radius: 4px;
					cursor: grab;
				}

				.settings-item:active {
					cursor: grabbing;
				}

				.settings-item.hidden-item {
					opacity: 0.5;
				}

				.drag-handle {
					color: var(--text-muted);
				}

				.item-icon {
					width: 20px;
					height: 20px;
					border-radius: 4px;
				}

				.item-title {
					flex: 1;
					font-size: 0.9rem;
					color: var(--text-primary);
				}

				.item-actions {
					display: flex;
					gap: 4px;
				}

				.action-btn {
					padding: 4px;
					background: none;
					border: none;
					color: var(--text-muted);
					cursor: pointer;
					border-radius: 4px;
				}

				.action-btn:hover {
					background: var(--bg-secondary);
					color: var(--text-primary);
				}

				.action-btn.danger:hover {
					color: var(--error);
				}

				.add-link-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 4px;
					width: 100%;
					padding: 12px;
					margin-top: 12px;
					background: transparent;
					border: 1px dashed var(--border);
					border-radius: 4px;
					color: var(--text-muted);
					cursor: pointer;
				}

				.add-link-btn:hover {
					background: var(--bg-tertiary);
					color: var(--text-primary);
				}

				.add-link-form {
					margin-top: 12px;
					display: flex;
					flex-direction: column;
					gap: 8px;
				}

				.add-link-input {
					padding: 8px 12px;
					background: var(--bg-tertiary);
					border: 1px solid var(--border);
					border-radius: 4px;
					color: var(--text-primary);
					font-size: 0.9rem;
				}

				.add-link-input:focus {
					outline: none;
					border-color: var(--accent);
				}

				.add-link-actions {
					display: flex;
					gap: 8px;
				}

				.modal-footer {
					display: flex;
					justify-content: flex-end;
					gap: 8px;
					padding: 16px;
					border-top: 1px solid var(--border);
				}
			`}</style>
		</div>
	);
}
