export const POST_TAGS = [
	"질문",
	"플러그인",
	"Skript",
	"모드",
	"모드팩",
	"데이터팩",
	"리소스팩",
	"프로그램",
	"바닐라",
	"장타서버",
	"단타서버",
	"해드립니다",
	"기타",
] as const;

export type PostTag = (typeof POST_TAGS)[number];
