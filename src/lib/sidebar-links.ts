export interface SidebarLink {
	title: string;
	url: string;
	icon_url?: string;
	category?: string;
	sort_order?: number;
	id?: string;
	isCustom?: boolean;
}

const CATEGORY_RANK: Record<string, number> = {
	외부링크: 100,
	"유용한 도구": 200,
	"AI 도구": 300,
	Custom: 900,
	기타: 999
};

function compareTextDeterministic(a: string, b: string): number {
	if (a === b) {
		return 0;
	}
	return a < b ? -1 : 1;
}

/**
 * 서버/클라이언트 환경에 상관없이 동일 결과를 보장하는 링크 정렬
 * - localeCompare 대신 코드포인트 비교 사용
 */
export function compareSidebarLinks(a: SidebarLink, b: SidebarLink): number {
	const catA = a.category || "기타";
	const catB = b.category || "기타";
	const categoryRankA = CATEGORY_RANK[catA] ?? 500;
	const categoryRankB = CATEGORY_RANK[catB] ?? 500;
	if (categoryRankA !== categoryRankB) {
		return categoryRankA - categoryRankB;
	}

	const categoryNameCompare = compareTextDeterministic(catA, catB);
	if (categoryNameCompare !== 0) {
		return categoryNameCompare;
	}

	const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
	const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
	if (orderA !== orderB) {
		return orderA - orderB;
	}

	const idA = a.id ?? "";
	const idB = b.id ?? "";
	const idCompare = compareTextDeterministic(idA, idB);
	if (idCompare !== 0) {
		return idCompare;
	}

	return compareTextDeterministic(a.title, b.title);
}

export const DEFAULT_LINKS: SidebarLink[] = [
	{
		id: "steve_gallery",
		title: "스티브 갤러리",
		url: "https://gall.dcinside.com/mgallery/board/lists/?id=steve",
		icon_url: "https://www.google.com/s2/favicons?domain=dcinside.com&sz=32",
		category: "외부링크",
		sort_order: 100,
		isCustom: false
	},
	{
		id: "spigot",
		title: "Spigot",
		url: "https://www.spigotmc.org/resources/",
		icon_url: "https://www.google.com/s2/favicons?domain=spigotmc.org&sz=32",
		category: "외부링크",
		sort_order: 101,
		isCustom: false
	},
	{
		id: "skript_docs",
		title: "Skript Docs",
		url: "https://skripthub.net/docs/",
		icon_url: "https://www.google.com/s2/favicons?domain=skripthub.net&sz=32",
		category: "외부링크",
		sort_order: 102,
		isCustom: false
	},
	{
		id: "github",
		title: "GitHub",
		url: "https://github.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=github.com&sz=32",
		category: "외부링크",
		sort_order: 103,
		isCustom: false
	},
	{
		id: "modrinth",
		title: "Modrinth",
		url: "https://modrinth.com/mods",
		icon_url: "https://www.google.com/s2/favicons?domain=modrinth.com&sz=32",
		category: "외부링크",
		sort_order: 104,
		isCustom: false
	},
	{
		id: "curseforge",
		title: "CurseForge",
		url: "https://www.curseforge.com/minecraft",
		icon_url: "https://www.google.com/s2/favicons?domain=curseforge.com&sz=32",
		category: "외부링크",
		sort_order: 105,
		isCustom: false
	},
	{
		id: "planet_minecraft",
		title: "Planet Minecraft",
		url: "https://www.planetminecraft.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=planetminecraft.com&sz=32",
		category: "외부링크",
		sort_order: 106,
		isCustom: false
	},
	{
		id: "mc_wiki",
		title: "MC Wiki",
		url: "https://minecraft.wiki/",
		icon_url: "https://www.google.com/s2/favicons?domain=minecraft.wiki&sz=32",
		category: "외부링크",
		sort_order: 107,
		isCustom: false
	},
	{
		id: "datapack_gen",
		title: "DataPack Gen",
		url: "https://misode.github.io/",
		icon_url: "https://www.google.com/s2/favicons?domain=misode.github.io&sz=32",
		category: "유용한 도구",
		sort_order: 200,
		isCustom: false
	},
	{
		id: "mcstacker",
		title: "MCstacker",
		url: "https://mcstacker.net/",
		icon_url: "https://www.google.com/s2/favicons?domain=mcstacker.net&sz=32",
		category: "유용한 도구",
		sort_order: 201,
		isCustom: false
	},
	{
		id: "toru",
		title: "Toru",
		url: "https://toru.shwa.space/",
		icon_url: "https://www.google.com/s2/favicons?domain=toru.shwa.space&sz=32",
		category: "유용한 도구",
		sort_order: 202,
		isCustom: false
	},
	{
		id: "streamable",
		title: "Streamable",
		url: "https://streamable.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=streamable.com&sz=32",
		category: "유용한 도구",
		sort_order: 203,
		isCustom: false
	},
	{
		id: "ai_modpack",
		title: "AI 모드팩 번역기",
		url: "https://mcat.2odk.com/",
		icon_url:
			"https://cdn.discordapp.com/icons/1460915912365572099/09ec2febf4174f65332d1aeb088b29b4.webp?size=160",
		category: "AI 도구",
		sort_order: 300,
		isCustom: false
	},
	{
		id: "chatgpt",
		title: "ChatGPT",
		url: "https://chat.openai.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=openai.com&sz=32",
		category: "AI 도구",
		sort_order: 301,
		isCustom: false
	},
	{
		id: "gemini",
		title: "Gemini",
		url: "https://gemini.google.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=gemini.google.com&sz=32",
		category: "AI 도구",
		sort_order: 302,
		isCustom: false
	},
	{
		id: "claude",
		title: "Claude",
		url: "https://claude.ai/",
		icon_url: "https://www.google.com/s2/favicons?domain=claude.ai&sz=32",
		category: "AI 도구",
		sort_order: 303,
		isCustom: false
	}
];
