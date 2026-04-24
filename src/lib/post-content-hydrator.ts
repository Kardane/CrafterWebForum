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
	const cardsByPreviewUrl = new Map<string, HTMLAnchorElement[]>();

	root.querySelectorAll<HTMLAnchorElement>(".external-link-card").forEach((card) => {
		const postId = card.dataset.postId;
		if (postId) {
			const list = cardsByPostId.get(postId) ?? [];
			list.push(card);
			cardsByPostId.set(postId, list);
		}

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
	const normalizedChips = chips
		.map((chip) => chip.trim())
		.filter((chip) => chip.length > 0);
	if (normalizedChips.length === 0) {
		return;
	}

	const body = ensureCardBody(card);
	let metaContainer = body.querySelector<HTMLDivElement>(".external-link-card__meta");
	if (!metaContainer) {
		metaContainer = document.createElement("div");
		metaContainer.className = "external-link-card__meta";
		body.appendChild(metaContainer);
	}
	metaContainer.innerHTML = "";
	normalizedChips.forEach((chip) => {
		const chipNode = document.createElement("span");
		chipNode.className = "external-link-card__meta-chip";
		chipNode.textContent = chip;
		metaContainer?.appendChild(chipNode);
	});
}

function renderStatus(card: HTMLAnchorElement, status?: string) {
	const body = ensureCardBody(card);
	const existing = body.querySelector<HTMLSpanElement>(".external-link-card__status");
	if (status === undefined) {
		return;
	}

	const normalized = status.trim();
	if (!normalized) {
		existing?.remove();
		return;
	}
	const statusNode = existing ?? document.createElement("span");
	statusNode.className = "external-link-card__status";
	statusNode.textContent = normalized;
	if (!existing) {
		body.appendChild(statusNode);
	}
}

function renderAuthor(card: HTMLAnchorElement, authorName?: string, authorAvatarUrl?: string) {
	const body = ensureCardBody(card);
	const existing = body.querySelector<HTMLSpanElement>(".external-link-card__author");
	const shouldUpdateAuthor = authorName !== undefined || authorAvatarUrl !== undefined;
	if (!shouldUpdateAuthor) {
		return;
	}

	const normalizedAuthorName = (authorName ?? "").trim();
	const normalizedAuthorAvatarUrl = (authorAvatarUrl ?? "").trim();

	if (!normalizedAuthorName && !normalizedAuthorAvatarUrl) {
		existing?.remove();
		return;
	}
	const authorNode = existing ?? document.createElement("span");
	authorNode.className = "external-link-card__author";
	authorNode.innerHTML = "";

	if (normalizedAuthorAvatarUrl) {
		const avatar = document.createElement("img");
		avatar.src = normalizedAuthorAvatarUrl;
		avatar.alt = "";
		avatar.className = "external-link-card__author-avatar";
		avatar.loading = "lazy";
		avatar.decoding = "async";
		authorNode.appendChild(avatar);
	}

	if (normalizedAuthorName) {
		const name = document.createElement("span");
		name.className = "external-link-card__author-name";
		name.textContent = normalizedAuthorName;
		authorNode.appendChild(name);
	}

	if (!existing) {
		body.appendChild(authorNode);
	}
}

function pushUniqueChip(chips: string[], value: string | undefined) {
	const normalized = value?.trim();
	if (!normalized || chips.includes(normalized)) {
		return;
	}
	chips.push(normalized);
}

function buildPreviewInfoChips(preview: LinkPreviewPayload) {
	const chips: string[] = [];
	for (const chip of preview.chips ?? []) {
		if (chips.length >= 2) {
			break;
		}
		pushUniqueChip(chips, chip);
	}

	const stats = preview.stats;
	if (stats) {
		if (stats.downloads !== undefined) pushUniqueChip(chips, `다운로드 ${stats.downloads.toLocaleString()}`);
		if (stats.stars !== undefined) pushUniqueChip(chips, `스타 ${stats.stars.toLocaleString()}`);
		if (stats.issues !== undefined) pushUniqueChip(chips, `이슈 ${stats.issues.toLocaleString()}`);
		if (stats.version) pushUniqueChip(chips, `버전 ${stats.version}`);
		if (stats.updatedAt) pushUniqueChip(chips, `업데이트 ${stats.updatedAt.split("T")[0]}`);
	}

	for (const metric of preview.metrics ?? []) {
		if (chips.length >= 4) {
			break;
		}
		pushUniqueChip(chips, metric);
	}

	return chips.slice(0, 4);
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
	if (preview.description !== undefined) {
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

	renderMeta(card, buildPreviewInfoChips(preview));
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
