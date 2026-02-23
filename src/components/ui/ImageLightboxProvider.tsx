"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import SafeImage from "@/components/ui/SafeImage";
import { appendBoundedSample, percentile } from "@/lib/perf-metrics";

interface LightboxImage {
	src: string;
	alt: string;
}

interface ImageLightboxContextValue {
	openImage: (image: LightboxImage) => void;
	closeImage: () => void;
}

const ImageLightboxContext = createContext<ImageLightboxContextValue | null>(null);
const PERF_SAMPLE_LIMIT = 120;
const PERF_LOG_ENABLED = process.env.NODE_ENV !== "production";

export function ImageLightboxProvider({ children }: { children: React.ReactNode }) {
	const [selectedImage, setSelectedImage] = useState<LightboxImage | null>(null);
	const openStartRef = useRef<number | null>(null);
	const modalOpenSamplesRef = useRef<number[]>([]);
	const imageLoadSamplesRef = useRef<number[]>([]);
	const longTaskCountRef = useRef(0);
	const longTaskMaxMsRef = useRef(0);

	useEffect(() => {
		if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
			return;
		}

		if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
			return;
		}

		const observer = new PerformanceObserver((list) => {
			const openStart = openStartRef.current;
			if (openStart === null) {
				return;
			}
			list.getEntries().forEach((entry) => {
				if (entry.startTime < openStart) {
					return;
				}
				longTaskCountRef.current += 1;
				longTaskMaxMsRef.current = Math.max(longTaskMaxMsRef.current, entry.duration);
			});
		});

		observer.observe({ entryTypes: ["longtask"] });
		return () => {
			observer.disconnect();
		};
	}, []);

	useEffect(() => {
		if (!selectedImage || openStartRef.current === null || typeof window === "undefined") {
			return;
		}

		const rafId = window.requestAnimationFrame(() => {
			if (openStartRef.current === null) {
				return;
			}
			const firstFrameMs = performance.now() - openStartRef.current;
			modalOpenSamplesRef.current = appendBoundedSample(
				modalOpenSamplesRef.current,
				firstFrameMs,
				PERF_SAMPLE_LIMIT
			);
		});

		return () => {
			window.cancelAnimationFrame(rafId);
		};
	}, [selectedImage]);

	const closeImage = useCallback(() => {
		if (PERF_LOG_ENABLED && openStartRef.current !== null) {
			const modalOpenP95 = percentile(modalOpenSamplesRef.current, 0.95);
			const imageLoadP95 = percentile(imageLoadSamplesRef.current, 0.95);
			console.info("[perf:image-lightbox]", {
				modalOpenP95Ms: modalOpenP95 ? Number(modalOpenP95.toFixed(1)) : null,
				imageLoadP95Ms: imageLoadP95 ? Number(imageLoadP95.toFixed(1)) : null,
				longTaskCount: longTaskCountRef.current,
				longTaskMaxMs: Number(longTaskMaxMsRef.current.toFixed(1)),
				totalSamples: {
					modalOpen: modalOpenSamplesRef.current.length,
					imageLoad: imageLoadSamplesRef.current.length,
				},
			});
		}

		openStartRef.current = null;
		longTaskCountRef.current = 0;
		longTaskMaxMsRef.current = 0;
		setSelectedImage(null);
	}, []);

	const openImage = useCallback((image: LightboxImage) => {
		const normalizedSrc = image.src.trim();
		if (!normalizedSrc) {
			return;
		}
		if (typeof performance !== "undefined") {
			openStartRef.current = performance.now();
		} else {
			openStartRef.current = null;
		}
		longTaskCountRef.current = 0;
		longTaskMaxMsRef.current = 0;
		setSelectedImage({
			src: normalizedSrc,
			alt: image.alt || "이미지",
		});
	}, []);

	const handleImageLoad = useCallback(() => {
		if (openStartRef.current === null || typeof performance === "undefined") {
			return;
		}
		const loadMs = performance.now() - openStartRef.current;
		imageLoadSamplesRef.current = appendBoundedSample(imageLoadSamplesRef.current, loadMs, PERF_SAMPLE_LIMIT);
	}, []);

	const value = useMemo<ImageLightboxContextValue>(
		() => ({
			openImage,
			closeImage,
		}),
		[openImage, closeImage]
	);

	return (
		<ImageLightboxContext.Provider value={value}>
			{children}
			<Modal
				isOpen={selectedImage !== null}
				onClose={closeImage}
				hideCloseButton
				size="xl"
				variant="sidebarLike"
				className="!max-w-[96vw] !border-none !bg-transparent !shadow-none"
				bodyClassName="!overflow-visible !p-0"
			>
				{selectedImage && (
					<div
						className="relative h-[82vh] w-[96vw] max-w-[1440px]"
						onClick={closeImage}
					>
						<SafeImage
							src={selectedImage.src}
							alt={selectedImage.alt}
							fill
							sizes="96vw"
							loading="eager"
							onLoad={handleImageLoad}
							onClick={(event) => {
								event.stopPropagation();
							}}
							className="object-contain"
						/>
					</div>
				)}
			</Modal>
		</ImageLightboxContext.Provider>
	);
}

export function useImageLightbox(): ImageLightboxContextValue {
	const context = useContext(ImageLightboxContext);
	if (!context) {
		throw new Error("useImageLightbox must be used within ImageLightboxProvider");
	}
	return context;
}
