"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import classNames from "classnames";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};

		if (isOpen) {
			window.addEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "hidden";
		}

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "unset";
		};
	}, [isOpen, onClose]);

	if (typeof window === "undefined") return null;

	const modalContent = (
		<div
			className={classNames(
				"fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-all duration-200",
				isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
			)}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className={classNames(
					"bg-bg-secondary w-full max-w-lg rounded-xl shadow-2xl border border-border flex flex-col max-h-[85vh] transition-all duration-300 transform",
					isOpen ? "translate-y-0 scale-100" : "-translate-y-4 scale-95",
					className
				)}
			>
				<div className="flex items-center justify-between p-4 border-b border-bg-tertiary">
					<h2 className="text-lg font-bold text-text-primary">{title}</h2>
					<button
						onClick={onClose}
						className="p-1 text-text-muted hover:text-text-primary rounded-full hover:bg-bg-tertiary transition-colors"
					>
						<X size={20} />
					</button>
				</div>

				<div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
			</div>
		</div>
	);

	return createPortal(modalContent, document.body);
}
