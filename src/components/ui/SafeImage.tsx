import Image, { type ImageLoaderProps, type ImageProps } from "next/image";

interface SafeImageProps extends Omit<ImageProps, "src" | "alt"> {
	src: string;
	alt: string;
}

const passthroughLoader = ({ src }: ImageLoaderProps): string => src;

export default function SafeImage({ src, alt, unoptimized = true, loader, ...props }: SafeImageProps) {
	const normalizedSrc = src.trim();
	if (!normalizedSrc) {
		return null;
	}

	return (
		<Image
			loader={loader ?? passthroughLoader}
			unoptimized={unoptimized}
			src={normalizedSrc}
			alt={alt}
			{...props}
		/>
	);
}
