"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import classNames from "classnames";

type ToastType = "success" | "error" | "info";

interface ToastOptions {
	type?: ToastType;
	message: string;
	duration?: number;
}

interface ToastItem {
	id: number;
	type: ToastType;
	message: string;
}

interface ToastContextValue {
	showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function resolveToastIcon(type: ToastType) {
	if (type === "success") return <CheckCircle2 size={16} />;
	if (type === "error") return <AlertTriangle size={16} />;
	return <Info size={16} />;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<ToastItem[]>([]);
	const nextIdRef = useRef(1);

	const removeToast = useCallback((id: number) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	const showToast = useCallback(
		({ type = "info", message, duration = 1800 }: ToastOptions) => {
			const id = nextIdRef.current++;
			setToasts((prev) => [...prev, { id, type, message }]);
			window.setTimeout(() => removeToast(id), duration);
		},
		[removeToast]
	);

	const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className="fixed inset-x-0 bottom-5 z-toast pointer-events-none flex flex-col items-center gap-2 px-4">
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className={classNames(
							"pointer-events-auto inline-flex max-w-[560px] items-center gap-2 rounded-md border px-4 py-2 text-sm shadow-lg backdrop-blur",
							{
								"bg-bg-secondary/95 border-border text-text-primary": toast.type === "info",
								"bg-[#2f4f3a]/95 border-[#57f287] text-[#d8ffe8]": toast.type === "success",
								"bg-[#5b2a2d]/95 border-[#ed4245] text-[#ffe3e3]": toast.type === "error",
							}
						)}
						role="status"
						aria-live="polite"
					>
						{resolveToastIcon(toast.type)}
						<span>{toast.message}</span>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToastContext(): ToastContextValue {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToastContext must be used within ToastProvider");
	}
	return context;
}
