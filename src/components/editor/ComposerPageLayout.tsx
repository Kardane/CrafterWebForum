"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ComposerPageLayoutProps {
	title: string;
	description?: string;
	backHref?: string;
	backLabel?: string;
	children: React.ReactNode;
}

export default function ComposerPageLayout({
	title,
	description,
	backHref = "/",
	backLabel = "목록으로",
	children,
}: ComposerPageLayoutProps) {
	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-2 pb-24 pt-1 md:px-4">
			<div className="rounded-xl border border-border bg-bg-secondary p-4 md:p-5">
				<div className="mb-4 flex items-center justify-between gap-3">
					<Link href={backHref} className="btn btn-secondary btn-sm">
						<ArrowLeft size={14} />
						{backLabel}
					</Link>
				</div>
				<div className="mb-4">
					<h1 className="text-2xl font-bold text-text-primary">{title}</h1>
					{description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
				</div>
				{children}
			</div>
		</div>
	);
}
