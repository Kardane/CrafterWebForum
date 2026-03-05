import { type SidebarLink, DEFAULT_LINKS, compareSidebarLinks } from "@/lib/sidebar-links";
import { type SidebarSettings, DEFAULT_SETTINGS, normalizeSidebarUrl } from "@/lib/sidebar-settings";

export function buildSidebarToolLinks(settings: SidebarSettings = DEFAULT_SETTINGS): SidebarLink[] {
	const customLinks = (settings.customLinks || []).reduce<SidebarLink[]>((acc, link) => {
		const normalizedUrl = normalizeSidebarUrl(link.url);
		if (!normalizedUrl) {
			return acc;
		}

		acc.push({
			...link,
			url: normalizedUrl,
			isCustom: true,
		});
		return acc;
	}, []);

	let allLinks: SidebarLink[] = [...DEFAULT_LINKS, ...customLinks];

	if (settings.order && settings.order.length > 0) {
		const orderMap = new Map(settings.order.map((id, index) => [id, index]));
		allLinks.sort((a, b) => {
			const orderA = orderMap.get(a.id!) ?? 9999;
			const orderB = orderMap.get(b.id!) ?? 9999;
			return orderA - orderB;
		});
	} else {
		allLinks.sort(compareSidebarLinks);
	}

	if (settings.hidden) {
		const hiddenIds = settings.hidden;
		allLinks = allLinks.filter((link) => !hiddenIds.includes(link.id!));
	}

	if (settings.deleted) {
		const deletedIds = settings.deleted;
		allLinks = allLinks.filter((link) => !deletedIds.includes(link.id!));
	}

	return allLinks;
}
