"use client";

import { useState, useEffect, DragEvent } from "react";
import { X, GripVertical, Plus, Trash2, Eye, EyeOff, RotateCcw } from "lucide-react";
import {
	SidebarSettings,
	getSidebarSettings,
	saveSidebarSettings,
	resetSidebarSettings,
	getFaviconUrl
} from "@/lib/sidebar-settings";
import { SidebarLink, DEFAULT_LINKS } from "@/lib/sidebar-links"; // DEFAULT_LINKS 임포트 수정

interface SidebarSettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

/**
 * 사이드바 설정 모달 - 레거시 스타일
 * - 드래그 정렬
 * - 링크 숨기기/표시
 * - 커스텀 링크 추가/편집/삭제
 */
export default function SidebarSettingsModal({
	isOpen,
	onClose
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

			// 기본 링크 (isCustom: false 강제)
			const defaultItems = DEFAULT_LINKS.map((l) => ({ ...l, isCustom: false }));

			// 커스텀 링크
			const customItems = (currentSettings.customLinks || []).map((l: any) => ({
				...l,
				isCustom: true
			}));

			// 전체 병합
			const allLinks = [...defaultItems, ...customItems];

			// 순서 정렬
			if (currentSettings.order && currentSettings.order.length > 0) {
				const orderMap = new Map<string, number>();
				currentSettings.order.forEach((id, index) => {
					orderMap.set(id, index);
				});

				allLinks.sort((a, b) => {
					const orderA = orderMap.get(a.id!) ?? 9999;
					const orderB = orderMap.get(b.id!) ?? 9999;
					return orderA - orderB;
				});
			} else {
				// 기본 정렬: 카테고리 -> sort_order
				allLinks.sort((a, b) => {
					const catA = a.category || "기타";
					const catB = b.category || "기타";
					if (catA !== catB) return catA.localeCompare(catB);

					const orderA = a.sort_order ?? 9999;
					const orderB = b.sort_order ?? 9999;
					return orderA - orderB;
				});
			}

			setItems(allLinks);
		}
	}, [isOpen]);

	// 드래그 핸들러
	const handleDragStart = (e: DragEvent<HTMLDivElement>, item: SidebarLink) => {
		setDraggedItem(item);
		e.dataTransfer.effectAllowed = "move";
		// 드래그 중인 요소의 투명도 조절
		e.currentTarget.style.opacity = "0.5";
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

	const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
		setDraggedItem(null);
		e.currentTarget.style.opacity = "1";
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
			customLinks: prev.customLinks?.filter((l: any) => l.id !== linkId) || [],
			order: prev.order?.filter((id) => id !== linkId) || [],
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
			category: "Custom",
			sort_order: 9999,
			isCustom: true
		};

		setItems((prev) => [...prev, newLink]);
		setSettings((prev) => ({
			...prev,
			customLinks: [...(prev.customLinks || []), newLink]
		}));

		setNewLinkTitle("");
		setNewLinkUrl("");
		setIsAddingLink(false);
	};

	// 저장
	const handleSave = () => {
		const newSettings: SidebarSettings = {
			...settings,
			order: items.map((item) => item.id!)
		};

		saveSidebarSettings(newSettings);

		// 사이드바 갱신 이벤트 발생
		window.dispatchEvent(new Event("sidebarSettingsChanged"));

		onClose();
	};

	// 초기화
	const handleReset = () => {
		if (!confirm("설정을 초기화하시겠습니까? (커스텀 링크는 삭제되지 않습니다)")) return;

		resetSidebarSettings();
		const resetSettings = getSidebarSettings();
		setSettings(resetSettings);

		// 커스텀 링크만 유지하고 순서 초기화
		// const customItems = items.filter(i => i.isCustom); // 아니면 삭제할지? 레거시는 초기화시 삭제되는듯
		// 사용자 요청이 '초기화'이므로 기본값으로 되돌림 (커스텀 링크 유지 여부는 정책 나름)
		// 여기서는 로컬스토리지 초기화 후 새로고침

		// 다시 로드 트리거
		window.dispatchEvent(new Event("sidebarSettingsChanged"));
		onClose();
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
							const isHidden = settings.hidden.includes(item.id!);

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
									<div className="drag-handle" title="드래그하여 이동">
										<GripVertical size={16} />
									</div>

									{/* 아이콘 */}
									<img
										src={item.icon_url || "https://via.placeholder.com/20"}
										alt=""
										className="item-icon"
									/>

									{/* 제목 */}
									<div className="item-title">{item.title}</div>

									{/* 액션 버튼 */}
									<div className="item-actions">
										<button
											className="action-btn"
											onClick={() => toggleVisibility(item.id!)}
											title={isHidden ? "표시" : "숨기기"}
										>
											{isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
										</button>

										{item.isCustom && (
											<button
												className="action-btn danger"
												onClick={() => deleteCustomLink(item.id!)}
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

					{/* 링크 추가 - 하단 고정 느낌 */}
					<div className="add-link-section">
						{isAddingLink ? (
							<div className="add-link-form">
								<input
									type="text"
									placeholder="제목"
									value={newLinkTitle}
									onChange={(e) => setNewLinkTitle(e.target.value)}
									className="add-link-input"
									autoFocus
								/>
								<input
									type="text"
									placeholder="URL (https://...)"
									value={newLinkUrl}
									onChange={(e) => setNewLinkUrl(e.target.value)}
									className="add-link-input"
								/>
								<div className="add-link-actions">
									<button className="btn btn-primary btn-sm flex-1" onClick={addLink}>
										추가
									</button>
									<button
										className="btn btn-secondary btn-sm flex-1"
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
								<span>링크 추가</span>
							</button>
						)}
					</div>
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
					max-width: 420px;
					max-height: 85vh;
					display: flex;
					flex-direction: column;
					border: 1px solid var(--border);
					box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
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
					display: flex;
				}

				.modal-close:hover {
					color: var(--text-primary);
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
					color: var(--text-muted);
					margin-bottom: 16px;
					flex-shrink: 0;
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

				.settings-item {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 8px 10px;
					background: var(--bg-tertiary);
					border-radius: 4px;
					border: 1px solid transparent;
					transition: all 0.2s;
				}

				.settings-item:hover {
					border-color: var(--border);
				}

				.settings-item.hidden-item {
					opacity: 0.5;
					background: var(--bg-secondary);
				}

				.drag-handle {
					color: var(--text-muted);
					cursor: grab;
					display: flex;
					padding: 2px;
				}

				.drag-handle:active {
					cursor: grabbing;
				}

				.item-icon {
					width: 20px;
					height: 20px;
					border-radius: 4px;
					object-fit: contain;
				}

				.item-title {
					flex: 1;
					font-size: 0.9rem;
					color: var(--text-primary);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.item-actions {
					display: flex;
					gap: 4px;
				}

				.action-btn {
					padding: 6px;
					background: none;
					border: none;
					color: var(--text-muted);
					cursor: pointer;
					border-radius: 4px;
					display: flex;
				}

				.action-btn:hover {
					background: var(--bg-secondary);
					color: var(--text-primary);
				}

				.action-btn.danger:hover {
					color: var(--error);
					background: rgba(255, 0, 0, 0.1);
				}

				.add-link-section {
					margin-top: 16px;
					padding-top: 16px;
					border-top: 1px solid var(--border);
					flex-shrink: 0;
				}

				.add-link-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 6px;
					width: 100%;
					padding: 10px;
					background: transparent;
					border: 1px dashed var(--border);
					border-radius: 4px;
					color: var(--text-muted);
					cursor: pointer;
					font-size: 0.9rem;
					transition: all 0.2s;
				}

				.add-link-btn:hover {
					background: var(--bg-tertiary);
					color: var(--text-primary);
					border-color: var(--text-muted);
				}

				.add-link-form {
					display: flex;
					flex-direction: column;
					gap: 8px;
					background: var(--bg-tertiary);
					padding: 12px;
					border-radius: 4px;
				}

				.add-link-input {
					padding: 8px 12px;
					background: var(--bg-secondary);
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
					margin-top: 4px;
				}

				.modal-footer {
					display: flex;
					justify-content: flex-end;
					gap: 8px;
					padding: 16px;
					border-top: 1px solid var(--border);
					background: var(--bg-tertiary);
					border-bottom-left-radius: 8px;
					border-bottom-right-radius: 8px;
				}

				/* 스크롤바 커스텀 */
				.settings-list::-webkit-scrollbar {
					width: 6px;
				}
				.settings-list::-webkit-scrollbar-track {
					background: transparent;
				}
				.settings-list::-webkit-scrollbar-thumb {
					background: var(--border);
					border-radius: 3px;
				}
				.settings-list::-webkit-scrollbar-thumb:hover {
					background: var(--text-muted);
				}
			`}</style>
		</div>
	);
}
