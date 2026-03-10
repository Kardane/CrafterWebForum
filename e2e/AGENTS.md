# E2E 가이드

## 개요

`e2e`는 Playwright 기반 브라우저 시나리오 모음.
현재 범위는 auth, admin, posts, notifications 흐름 중심이고 Chromium 단일 프로젝트만 사용.

## 컨벤션

- 파일명은 `*.spec.ts`.
- 기본 `baseURL`은 `http://127.0.0.1:3000`, 외부 서버 검증 시 `E2E_BASE_URL` 사용.
- 로컬은 retries 0, CI는 retries 2.
- 브라우저 측 capability mocking은 `context.addInitScript()` 패턴 사용 가능.
- 환경 의존 시 `test.skip(...)`로 명시적 gating 유지.

## 어디부터 볼지

| 흐름 | 파일 | 메모 |
|------|------|------|
| 로그인/가입 | `auth.spec.ts` | 인증 기본 흐름 |
| 관리자 | `admin.spec.ts` | 권한/관리 페이지 |
| 포스트 | `posts.spec.ts` | 작성 페이지 접근 보호 등 |
| 알림 | `notifications.spec.ts` | 가장 env/브라우저 의존적 |

## 이 디렉터리 안티패턴

- 외부 env 없이 깨지는 테스트를 unconditional로 남기는 패턴 금지.
- UI assertion 전에 URL/redirect 안정화 확인 생략 금지.
- DB polling 필요한 시나리오에서 타임아웃/재시도 없이 단정하는 패턴 금지.

## 실행

```bash
npm run test:e2e
npm run test:e2e:ui
```

## 노트

- `npm run dev`를 webServer로 자동 띄우므로 로컬 서버가 이미 있으면 재사용됨.
- 현재 파일 수는 적지만 환경 의존성이 강해서 문서화 가치 있음.
