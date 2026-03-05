import type { LinkPreview } from "@/lib/link-preview/types";

export interface GitHubPreviewDependencies {
	toFavicon: (hostname: string) => string;
	fallbackPreview: (parsedUrl: URL, provider?: string, kind?: string) => LinkPreview;
	fetchGitHubWithTimeout: (url: string) => Promise<Response>;
	asRecord: (value: unknown) => Record<string, unknown> | null;
	asNumber: (value: unknown) => number | null;
	asStringArray: (value: unknown) => string[];
	normalizeText: (value: unknown, fallback?: string) => string;
	clampText: (value: unknown, maxLength?: number) => string | undefined;
	formatMetric: (icon: string, value: number, label: string) => string;
}

export async function buildGitHubPreview(
	parsedUrl: URL,
	deps: GitHubPreviewDependencies
): Promise<LinkPreview> {
	const iconUrl = deps.toFavicon("github.com");
	const segments = parsedUrl.pathname.split("/").filter(Boolean);

	if (segments.length === 1) {
		const login = segments[0];
		const response = await deps.fetchGitHubWithTimeout(`https://api.github.com/users/${encodeURIComponent(login)}`);
		if (!response.ok) {
			return {
				...deps.fallbackPreview(parsedUrl, "github", "profile"),
				badge: "GitHub 프로필",
				title: `@${login}`,
				subtitle: "GitHub 프로필",
				iconUrl,
			};
		}
		const user = deps.asRecord(await response.json());
		const followers = deps.asNumber(user?.followers) ?? 0;
		const following = deps.asNumber(user?.following) ?? 0;
		const repos = deps.asNumber(user?.public_repos) ?? 0;
		return {
			provider: "github",
			kind: "profile",
			badge: "GitHub 프로필",
			title: deps.normalizeText(user?.name, `@${login}`),
			subtitle: `@${deps.normalizeText(user?.login, login)}`,
			description: deps.clampText(user?.bio),
			imageUrl: deps.normalizeText(user?.avatar_url),
			iconUrl,
			chips: [deps.formatMetric("📦", repos, "레포")],
			metrics: [deps.formatMetric("👥", followers, "팔로워"), deps.formatMetric("➡", following, "팔로잉")],
		};
	}

	if (segments.length < 2) {
		return {
			...deps.fallbackPreview(parsedUrl, "github", "other"),
			badge: "GitHub",
			iconUrl,
		};
	}

	const [owner, repo, section, sectionId] = segments;
	const repoPath = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
	const repoResponse = await deps.fetchGitHubWithTimeout(`https://api.github.com/repos/${repoPath}`);
	const repoData = repoResponse.ok ? deps.asRecord(await repoResponse.json()) : null;
	const repositoryTitle = `${owner}/${repo}`;
	const repositoryDescription = deps.clampText(repoData?.description);
	const ownerData = deps.asRecord(repoData?.owner);
	const repositoryAvatar = deps.normalizeText(ownerData?.avatar_url);
	const repositoryOwnerLogin = deps.normalizeText(ownerData?.login, owner);
	const repositoryOwnerLabel = repositoryOwnerLogin ? `@${repositoryOwnerLogin}` : `@${owner}`;
	const licenseId = deps.normalizeText(deps.asRecord(repoData?.license)?.spdx_id);
	const repoVisibility = deps.normalizeText(repoData?.visibility);
	const isArchived = Boolean(repoData?.archived);
	const isFork = Boolean(repoData?.fork);
	const repositoryChips = [
		deps.clampText(repoData?.language, 32),
		repoVisibility ? `가시성 ${repoVisibility}` : "",
		licenseId && licenseId !== "NOASSERTION" ? `라이선스 ${licenseId}` : "",
		isArchived ? "archived" : "",
		isFork ? "fork" : "",
	]
		.filter((item): item is string => Boolean(item))
		.slice(0, 4);
	const repositoryStats = {
		stars: deps.asNumber(repoData?.stargazers_count) ?? 0,
		forks: deps.asNumber(repoData?.forks_count) ?? 0,
		issues: deps.asNumber(repoData?.open_issues_count) ?? 0,
		updatedAt: deps.normalizeText(repoData?.pushed_at || repoData?.updated_at),
	};
	const repositoryCardStats = {
		stars: repositoryStats.stars,
		issues: repositoryStats.issues,
	};

	if (section === "issues" && sectionId) {
		const issueResponse = await deps.fetchGitHubWithTimeout(
			`https://api.github.com/repos/${repoPath}/issues/${encodeURIComponent(sectionId)}`
		);
		const issue = issueResponse.ok ? deps.asRecord(await issueResponse.json()) : null;
		const issueAuthor = deps.asRecord(issue?.user);
		const issueComments = deps.asNumber(issue?.comments) ?? 0;
		const labels = Array.isArray(issue?.labels)
			? (issue.labels
					.map((label) => deps.normalizeText(deps.asRecord(label)?.name))
					.filter((value) => value.length > 0) as string[])
			: [];
		const stateRaw = deps.normalizeText(issue?.state, "unknown").toUpperCase();
		return {
			provider: "github",
			kind: "issue",
			badge: "GitHub 이슈",
			title: deps.normalizeText(issue?.title, `${repositoryTitle} · Issue #${sectionId}`),
			subtitle: `${repositoryTitle} · Issue #${sectionId}`,
			description: deps.clampText(issue?.body),
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: deps.normalizeText(issueAuthor?.login),
			authorAvatarUrl: deps.normalizeText(issueAuthor?.avatar_url),
			status: stateRaw,
			chips: [...repositoryChips, ...labels.slice(0, 3), labels.length > 3 ? `+${labels.length - 3}` : ""].filter(
				(item) => item.length > 0
			),
			metrics: [deps.formatMetric("💬", issueComments, "댓글")],
			stats: {
				stars: repositoryStats.stars,
				forks: repositoryStats.forks,
				updatedAt: repositoryStats.updatedAt,
			},
		};
	}

	if ((section === "pull" || section === "pulls") && sectionId) {
		const pullResponse = await deps.fetchGitHubWithTimeout(
			`https://api.github.com/repos/${repoPath}/pulls/${encodeURIComponent(sectionId)}`
		);
		const pull = pullResponse.ok ? deps.asRecord(await pullResponse.json()) : null;
		const state = deps.normalizeText(pull?.state, "unknown").toUpperCase();
		const mergedAt = deps.normalizeText(pull?.merged_at);
		const isDraft = Boolean(pull?.draft);
		const pullAuthor = deps.asRecord(pull?.user);
		const commits = deps.asNumber(pull?.commits) ?? 0;
		const changedFiles = deps.asNumber(pull?.changed_files) ?? 0;
		const additions = deps.asNumber(pull?.additions) ?? 0;
		const deletions = deps.asNumber(pull?.deletions) ?? 0;
		const pullComments = deps.asNumber(pull?.comments) ?? 0;
		const reviewComments = deps.asNumber(pull?.review_comments) ?? 0;
		const baseRef = deps.normalizeText(deps.asRecord(pull?.base)?.ref);
		const headRef = deps.normalizeText(deps.asRecord(pull?.head)?.ref);
		return {
			provider: "github",
			kind: "pull_request",
			badge: "GitHub PR",
			title: deps.normalizeText(pull?.title, `${repositoryTitle} · PR #${sectionId}`),
			subtitle: `${repositoryTitle} · PR #${sectionId}`,
			description: deps.clampText(pull?.body),
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: deps.normalizeText(pullAuthor?.login),
			authorAvatarUrl: deps.normalizeText(pullAuthor?.avatar_url),
			status: mergedAt ? "MERGED" : isDraft ? "DRAFT" : state,
			chips: [
				...repositoryChips,
				baseRef && headRef ? `${headRef} → ${baseRef}` : "",
				isDraft ? "draft" : "",
			]
				.filter((item) => item.length > 0)
				.slice(0, 4),
			metrics: [
				deps.formatMetric("🧩", commits, "커밋"),
				deps.formatMetric("📄", changedFiles, "파일"),
				deps.formatMetric("＋", additions, "추가"),
				deps.formatMetric("－", deletions, "삭제"),
				deps.formatMetric("💬", pullComments + reviewComments, "댓글"),
			],
			stats: {
				stars: repositoryStats.stars,
				forks: repositoryStats.forks,
				updatedAt: repositoryStats.updatedAt,
			},
		};
	}

	if (section === "wiki") {
		const wikiTitleRaw = segments.slice(3).join("/") || "Home";
		let wikiTitle = wikiTitleRaw;
		try {
			wikiTitle = decodeURIComponent(wikiTitleRaw);
		} catch {
			wikiTitle = wikiTitleRaw;
		}
		return {
			provider: "github",
			kind: "wiki",
			badge: "GitHub Wiki",
			title: wikiTitle,
			subtitle: `${repositoryTitle} · Wiki`,
			description: repositoryDescription,
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: repositoryOwnerLabel,
			authorAvatarUrl: repositoryAvatar,
			chips: repositoryChips,
			metrics: [],
			stats: {
				stars: repositoryStats.stars,
				forks: repositoryStats.forks,
				updatedAt: repositoryStats.updatedAt,
			},
		};
	}

	if (section === "releases") {
		return {
			provider: "github",
			kind: "release",
			badge: "GitHub 릴리스",
			title: repositoryTitle,
			subtitle: `${repositoryTitle} · Releases`,
			description: repositoryDescription,
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: repositoryOwnerLabel,
			authorAvatarUrl: repositoryAvatar,
			chips: repositoryChips,
			metrics: [],
			stats: repositoryStats,
		};
	}

	return {
		provider: "github",
		kind: "repository",
		badge: "GitHub 저장소",
		title: repositoryTitle,
		subtitle: "GitHub 저장소",
		description: repositoryDescription,
		imageUrl: repositoryAvatar,
		iconUrl,
		authorName: repositoryOwnerLabel,
		authorAvatarUrl: repositoryAvatar,
		chips: repositoryChips,
		metrics: [],
		stats: repositoryCardStats,
	};
}
