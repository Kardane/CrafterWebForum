"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import classNames from "classnames";

type ModalSize = "sm" | "md" | "lg" | "xl";
type ModalVariant = "default" | "sidebarLike";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
	bodyClassName?: string;
	footer?: React.ReactNode;
	size?: ModalSize;
	variant?: ModalVariant;
	onEnter?: () => void;
	closeOnBackdrop?: boolean;
	closeOnEsc?: boolean;
	hideCloseButton?: boolean;
}

const SIZE_CLASS_MAP: Record<ModalSize, string> = {
	sm: "max-w-md",
	md: "max-w-lg",
	lg: "max-w-2xl",
	xl: "max-w-4xl",
};

export function Modal({
	isOpen,
	onClose,
	title,
	children,
	className,
	bodyClassName,
	footer,
	size = "md",
	variant = "default",
	onEnter,
	closeOnBackdrop = true,
	closeOnEsc = true,
	hideCloseButton = false,
}: ModalProps) {
	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const prevOverflow = document.body.style.overflow;
		const prevPosition = document.body.style.position;
		const prevTop = document.body.style.top;
		const prevLeft = document.body.style.left;
		const prevRight = document.body.style.right;
		const prevWidth = document.body.style.width;
		const scrollY = window.scrollY;
		document.body.style.overflow = "hidden";
		document.body.style.position = "fixed";
		document.body.style.top = `-${scrollY}px`;
		document.body.style.left = "0";
		document.body.style.right = "0";
		document.body.style.width = "100%";

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				if (closeOnEsc) {
					onClose();
				}
				return;
			}
			if (
				event.key === "Enter" &&
				onEnter &&
				!event.shiftKey &&
				!event.ctrlKey &&
				!event.altKey &&
				!event.metaKey &&
				!(event.target instanceof HTMLTextAreaElement)
			) {
				event.preventDefault();
				onEnter();
			}
		};
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = prevOverflow;
			document.body.style.position = prevPosition;
			document.body.style.top = prevTop;
			document.body.style.left = prevLeft;
			document.body.style.right = prevRight;
			document.body.style.width = prevWidth;
			window.scrollTo({ top: scrollY, behavior: "auto" });
		};
	}, [isOpen, closeOnEsc, onClose, onEnter]);

	if (typeof window === "undefined") return null;

	const showHeader = Boolean(title) || !hideCloseButton;
	const headerClassName =
		variant === "sidebarLike"
			? "flex items-center justify-between p-4 border-b border-border"
			: "flex items-center justify-between p-4 border-b border-bg-tertiary";
	const panelClassName =
		variant === "sidebarLike"
			? "bg-bg-primary border border-border rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
			: "bg-bg-secondary border border-border rounded-xl shadow-2xl";
	const overlayClassName =
		variant === "sidebarLike" ? "bg-black/70 backdrop-blur-[4px]" : "bg-black/70 backdrop-blur-sm";

	const modalContent = (
		<div
			className={classNames(
				"fixed inset-0 z-modal flex items-center justify-center p-4 transition-all duration-200",
				overlayClassName,
				isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
			)}
			onClick={(event) => {
				if (!closeOnBackdrop) return;
				if (event.target === event.currentTarget) {
					onClose();
				}
			}}
		>
			<div
				className={classNames(
					"w-full max-h-[90vh] flex flex-col transition-all duration-300 transform",
					SIZE_CLASS_MAP[size],
					panelClassName,
					isOpen ? "translate-y-0 scale-100" : "-translate-y-4 scale-95",
					className
				)}
			>
				{showHeader && (
					<div className={headerClassName}>
						<h2 className="text-lg font-bold text-text-primary">{title ?? ""}</h2>
						{!hideCloseButton && (
							<button
								type="button"
								onClick={onClose}
								className="p-1 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
								aria-label="모달 닫기"
							>
								<X size={20} />
							</button>
						)}
					</div>
				)}

				<div className={classNames("p-6 overflow-y-auto custom-scrollbar", bodyClassName)}>{children}</div>

				{footer && <div className="px-4 py-3 border-t border-border bg-bg-tertiary">{footer}</div>}
			</div>
		</div>
	);

	return createPortal(modalContent, document.body);
}
