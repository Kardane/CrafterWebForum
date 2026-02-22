export interface LinkPreviewPayload {
	badge?: string;
	title?: string;
	subtitle?: string;
	description?: string;
	imageUrl?: string;
	iconUrl?: string;
	authorName?: string;
	authorAvatarUrl?: string;
	status?: string;
	chips?: string[];
	metrics?: string[];
	stats?: {
		stars?: number;
		forks?: number;
		issues?: number;
		pulls?: number;
		downloads?: number;
		updatedAt?: string;
		version?: string;
		platforms?: string[];
		environments?: string[];
	};
}

export interface PostMetaItemPayload {
	id: number;
	category: string;
	views: number;
	likes: number;
	comments: number;
}

export function collectExternalLinkCards(root: HTMLElement) {
	const cardsByPostId = new Map<string, HTMLAnchorElement[]>();
	root.querySelectorAll<HTMLAnchorElement>(".external-link-card[data-post-id]").forEach((card) => {
		const postId = card.dataset.postId;
		if (!postId) {
			return;
		}
		const list = cardsByPostId.get(postId) ?? [];
		list.push(card);
		cardsByPostId.set(postId, list);
	});

	const cardsByPreviewUrl = new Map<string, HTMLAnchorElement[]>();
	root.querySelectorAll<HTMLAnchorElement>(".external-link-card[data-preview-url]").forEach((card) => {
		const previewUrl = card.dataset.previewUrl;
		if (!previewUrl) {
			return;
		}
		const list = cardsByPreviewUrl.get(previewUrl) ?? [];
		list.push(card);
		cardsByPreviewUrl.set(previewUrl, list);
	});

	return {
		cardsByPostId,
		cardsByPreviewUrl,
	};
}

function ensureCardBody(card: HTMLAnchorElement) {
	return card.querySelector<HTMLSpanElement>(".external-link-card__body") ?? card;
}

export function renderMeta(card: HTMLAnchorElement, chips: string[]) {
	const body = ensureCardBody(card);
	let metaContainer = body.querySelector<HTMLDivElement>(".external-link-card__meta");
	if (!metaContainer) {
		metaContainer = document.createElement("div");
		metaContainer.className = "external-link-card__meta";
		body.appendChild(metaContainer);
	}
	metaContainer.innerHTML = "";
	chips.forEach((chip) => {
		const chipNode = document.createElement("span");
		chipNode.className = "external-link-card__meta-chip";
		chipNode.textContent = chip;
		metaContainer?.appendChild(chipNode);
	});
}

function renderStatus(card: HTMLAnchorElement, status?: string) {
	const body = ensureCardBody(card);
	const existing = body.querySelector<HTMLSpanElement>(".external-link-card__status");
	if (!status) {
		existing?.remove();
		return;
	}
	const statusNode = existing ?? document.createElement("span");
	statusNode.className = "external-link-card__status";
	statusNode.textContent = status;
	if (!existing) {
		body.appendChild(statusNode);
	}
}

function renderAuthor(card: HTMLAnchorElement, authorName?: string, authorAvatarUrl?: string) {
	const body = ensureCardBody(card);
	const existing = body.querySelector<HTMLSpanElement>(".external-link-card__author");
	if (!authorName && !authorAvatarUrl) {
		existing?.remove();
		return;
	}
	const authorNode = existing ?? document.createElement("span");
	authorNode.className = "external-link-card__author";
	authorNode.innerHTML = "";

	if (authorAvatarUrl) {
		const avatar = document.createElement("img");
		avatar.src = authorAvatarUrl;
		avatar.alt = "";
		avatar.className = "external-link-card__author-avatar";
		avatar.loading = "lazy";
		avatar.decoding = "async";
		authorNode.appendChild(avatar);
	}

	if (authorName) {
		const name = document.createElement("span");
		name.className = "external-link-card__author-name";
		name.textContent = authorName;
		authorNode.appendChild(name);
	}

	if (!existing) {
		body.appendChild(authorNode);
	}
}

export function renderPreviewCard(card: HTMLAnchorElement, preview: LinkPreviewPayload) {
	const body = ensureCardBody(card);
	const badgeNode = card.querySelector<HTMLElement>(".external-link-card__badge");
	if (badgeNode && preview.badge) {
		badgeNode.textContent = preview.badge;
	}

	const titleNode = card.querySelector<HTMLElement>(".external-link-card__title");
	if (titleNode && preview.title) {
		titleNode.textContent = preview.title;
	}

	const subtitleNode = card.querySelector<HTMLElement>(".external-link-card__subtitle");
	if (subtitleNode) {
		subtitleNode.textContent = preview.subtitle || subtitleNode.textContent || "";
	}
	const existingDescription = body.querySelector<HTMLElement>(".external-link-card__description");
	if (preview.description) {
		const descriptionNode = existingDescription ?? document.createElement("span");
		descriptionNode.className = "external-link-card__description";
		descriptionNode.textContent = preview.description;
		if (!existingDescription) {
			body.appendChild(descriptionNode);
		}
	} else {
		existingDescription?.remove();
	}

	const thumbnailNode = card.querySelector<HTMLImageElement>(".external-link-card__thumb");
	const iconNode = card.querySelector<HTMLImageElement>(".external-link-card__icon");
	const mediaImageUrl = preview.imageUrl || preview.authorAvatarUrl || preview.iconUrl;
	if (thumbnailNode && mediaImageUrl) {
		thumbnailNode.src = mediaImageUrl;
	}
	if (iconNode && preview.iconUrl) {
		iconNode.src = preview.iconUrl;
	}

	renderAuthor(card, preview.authorName, preview.authorAvatarUrl);
	renderStatus(card, preview.status);

	const chips = [...(preview.chips ?? [])];
	if (preview.stats) {
		const stats = preview.stats;
		if (stats.downloads !== undefined) chips.push(`⬇ ${stats.downloads.toLocaleString()} 다운로드`);
		if (stats.stars !== undefined) chips.push(`★ ${stats.stars.toLocaleString()} 스타`);
		if (stats.forks !== undefined) chips.push(`⑂ ${stats.forks.toLocaleString()} 포크`);
		if (stats.issues !== undefined) chips.push(`💬 ${stats.issues.toLocaleString()} 이슈`);
		if (stats.pulls !== undefined) chips.push(`🧩 ${stats.pulls.toLocaleString()} PR`);
		if (stats.version) chips.push(`버전 ${stats.version}`);
		if (stats.updatedAt) {
			const dateStr = stats.updatedAt.split("T")[0];
			chips.push(`업데이트 ${dateStr}`);
		}
	}
	chips.push(...(preview.metrics ?? []));

	renderMeta(card, chips);
}

export function buildPostMetaChips(item: PostMetaItemPayload) {
	return [
		`카테고리: ${item.category || "일반"}`,
		`조회 ${item.views ?? 0}`,
		`추천 ${item.likes ?? 0}`,
		`댓글 ${item.comments ?? 0}`,
	];
}

export function shouldHideExternalCardImage(target: HTMLImageElement) {
	if (!target.closest(".external-link-card")) {
		return false;
	}
	return (
		target.classList.contains("external-link-card__thumb") ||
		target.classList.contains("external-link-card__icon") ||
		target.classList.contains("external-link-card__author-avatar")
	);
}
