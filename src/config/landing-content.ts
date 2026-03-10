export const LANDING_BACKGROUND_IMAGE_URL = "/img/background.png";

export const LANDING_CONTENT = {
	brandEyebrow: "Steve Gallery",
	title: "메인화면",
	loggedInGreetingPrefix: "환영합니다",
	guestActions: {
		login: "로그인",
		register: "회원가입",
	},
	description:
		"개발 관련으로 이야기를 나누거나, 갤러리 서버 완장에게 할 말을 남기세요.",
	cards: {
		develope: {
			title: "개발 포스트",
			description: "개발 포럼 - 플러그인, Skript, 모드, 모드팩 등 여러가지 개발 관련 이야기를 나눕니다.",
			enterLabel: "입장하기 >",
		},
		sinmungo: {
			title: "서버 신문고",
			description: "갤러리에서 유저들이 운영하는 서버의 이슈를 서버 완장에게 전달합니다.",
			enterLabel: "입장하기 >",
		},
		profile: {
			title: "내 정보",
			description: "작성 통계, 알림 상태, 계정 정보를 한곳에서 확인합니다.",
			enterLabel: "입장하기 >",
		},
	},
} as const;
