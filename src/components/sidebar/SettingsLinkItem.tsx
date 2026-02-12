"use client";

/**
 * 사이드바 설정 - 개별 링크 행
 * 드래그 핸들 + 아이콘 + 제목 + 가시성 토글 + 삭제 버튼
 */

import type { DragEvent } from "react";
import { GripVertical, Eye, EyeOff, Trash2 } from "lucide-react";
import type { SidebarLink } from "@/lib/sidebar-links";

interface SettingsLinkItemProps {
	item: SidebarLink;
	index: number;
	isHidden: boolean;
	onDragStart: (e: DragEvent<HTMLDivElement>, item: SidebarLink) => void;
	onDragOver: (e: DragEvent<HTMLDivElement>, index: number) => void;
	onDragEnd: (e: DragEvent<HTMLDivElement>) => void;
	onToggleVisibility: (linkId: string) => void;
	onDelete: (linkId: string, isCustom: boolean) => void;
}

export default function SettingsLinkItem({
	item,
	index,
	isHidden,
	onDragStart,
	onDragOver,
	onDragEnd,
	onToggleVisibility,
	onDelete,
}: SettingsLinkItemProps) {
	return (
		<>
			<div
				className={`settings-item ${isHidden ? "hidden-item" : ""}`}
				draggable
				onDragStart={(e) => onDragStart(e, item)}
				onDragOver={(e) => onDragOver(e, index)}
				onDragEnd={onDragEnd}
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
						onClick={() => onToggleVisibility(item.id!)}
						title={isHidden ? "표시" : "숨기기"}
					>
						{isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
					</button>

					<button
						className="action-btn danger"
						onClick={() => onDelete(item.id!, !!item.isCustom)}
						title="삭제"
					>
						<Trash2 size={16} />
					</button>
				</div>
			</div>

			<style jsx>{`
				.settings-item {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 8px 10px;
					background: var(--color-bg-tertiary);
					border-radius: 4px;
					border: 1px solid transparent;
					transition: all 0.2s;
				}
				.settings-item:hover {
					border-color: var(--color-border);
				}
				.settings-item.hidden-item {
					opacity: 0.5;
					background: var(--color-bg-secondary);
				}
				.drag-handle {
					color: var(--color-text-muted);
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
					color: var(--color-text-primary);
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
					color: var(--color-text-muted);
					cursor: pointer;
					border-radius: 4px;
					display: flex;
				}
				.action-btn:hover {
					background: var(--color-bg-secondary);
					color: var(--color-text-primary);
				}
				.action-btn.danger:hover {
					color: var(--color-error);
					background: rgba(255, 0, 0, 0.1);
				}
			`}</style>
		</>
	);
}
