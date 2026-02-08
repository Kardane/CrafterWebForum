export interface SidebarLink {
	title: string;
	url: string;
	icon_url?: string;
	category?: string;
	sort_order?: number;
	id?: string;
	isCustom?: boolean;
}

export const DEFAULT_LINKS: SidebarLink[] = [
	{
		title: "스티브 갤러리",
		url: "https://gall.dcinside.com/mgallery/board/lists/?id=steve",
		icon_url: "https://www.google.com/s2/favicons?domain=dcinside.com&sz=32",
		category: "외부링크",
		sort_order: 100
	},
	{
		title: "Spigot",
		url: "https://www.spigotmc.org/resources/",
		icon_url: "https://www.google.com/s2/favicons?domain=spigotmc.org&sz=32",
		category: "외부링크",
		sort_order: 101
	},
	{
		title: "Skript Docs",
		url: "https://skripthub.net/docs/",
		icon_url: "https://www.google.com/s2/favicons?domain=skripthub.net&sz=32",
		category: "외부링크",
		sort_order: 102
	},
	{
		title: "GitHub",
		url: "https://github.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=github.com&sz=32",
		category: "외부링크",
		sort_order: 103
	},
	{
		title: "Modrinth",
		url: "https://modrinth.com/mods",
		icon_url: "https://www.google.com/s2/favicons?domain=modrinth.com&sz=32",
		category: "외부링크",
		sort_order: 104
	},
	{
		title: "CurseForge",
		url: "https://www.curseforge.com/minecraft",
		icon_url: "https://www.google.com/s2/favicons?domain=curseforge.com&sz=32",
		category: "외부링크",
		sort_order: 105
	},
	{
		title: "Planet Minecraft",
		url: "https://www.planetminecraft.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=planetminecraft.com&sz=32",
		category: "외부링크",
		sort_order: 106
	},
	{
		title: "MC Wiki",
		url: "https://minecraft.wiki/",
		icon_url: "https://www.google.com/s2/favicons?domain=minecraft.wiki&sz=32",
		category: "외부링크",
		sort_order: 107
	},
	{
		title: "DataPack Gen",
		url: "https://misode.github.io/",
		icon_url: "https://www.google.com/s2/favicons?domain=misode.github.io&sz=32",
		category: "유용한 도구",
		sort_order: 200
	},
	{
		title: "MCstacker",
		url: "https://mcstacker.net/",
		icon_url: "https://www.google.com/s2/favicons?domain=mcstacker.net&sz=32",
		category: "유용한 도구",
		sort_order: 201
	},
	{
		title: "Toru",
		url: "https://toru.shwa.space/",
		icon_url: "https://www.google.com/s2/favicons?domain=toru.shwa.space&sz=32",
		category: "유용한 도구",
		sort_order: 202
	},
	{
		title: "Streamable",
		url: "https://streamable.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=streamable.com&sz=32",
		category: "유용한 도구",
		sort_order: 203
	},
	{
		title: "AI 모드팩 번역기",
		url: "https://mcat.2odk.com/",
		icon_url:
			"https://cdn.discordapp.com/icons/1460915912365572099/09ec2febf4174f65332d1aeb088b29b4.webp?size=160",
		category: "AI 도구",
		sort_order: 300
	},
	{
		title: "ChatGPT",
		url: "https://chat.openai.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=openai.com&sz=32",
		category: "AI 도구",
		sort_order: 301
	},
	{
		title: "Gemini",
		url: "https://gemini.google.com/",
		icon_url: "https://www.google.com/s2/favicons?domain=gemini.google.com&sz=32",
		category: "AI 도구",
		sort_order: 302
	},
	{
		title: "Claude",
		url: "https://claude.ai/",
		icon_url: "https://www.google.com/s2/favicons?domain=claude.ai&sz=32",
		category: "AI 도구",
		sort_order: 303
	}
].map((link) => ({
	...link,
	// URL 기반 고유 ID 생성 (특수문자 제거)
	id: btoa(link.url).replace(/[^a-zA-Z0-9]/g, "").substring(0, 16),
	isCustom: false
}));
