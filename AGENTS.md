# CrafterWebForum 작업 지식베이스

**생성:** 2026-03-10
**커밋:** `bbadaf0`
**브랜치:** `master`

## 개요

마인크래프트 커뮤니티 포럼 성격의 Next.js 16 앱 프로젝트.
핵심 축은 App Router, Prisma(SQLite/Turso), NextAuth, Vitest, Playwright, Web Push, 댓글 실시간 동기화 구성.

## 구조

```text
CrafterWebForum/
├── src/app/                 # 페이지와 API 라우트, 인증/관리자/포스트 진입면
├── src/components/          # 기능별 UI. comments만 별도 규칙 강함
├── src/lib/                 # DB, 보안, 푸시, 링크 프리뷰, 서비스 계층
├── src/__tests__/           # Vitest 단위/통합 테스트
├── scripts/                 # 로컬 setup, 마이그레이션, 배포 점검
├── e2e/                     # Playwright E2E
├── prisma/schema.prisma     # SQLite 기준 스키마 원본
└── 보고서/                  # 아키텍처 참고 문서. `ARCHITECTURE_REVIEW.md`만 활성 참고 대상
```

## 우선 탐색 위치

| 작업 | 위치 | 메모 |
|------|------|------|
| 포스트/피드/상세 로직 | `src/app/page.tsx`, `src/lib/services/posts-service.ts`, `src/lib/services/post-detail-service.ts` | 서버 렌더 + 서비스 계층 분리 |
| API 수정 | `src/app/api/` | 라우트는 얇게, 검증/권한/서비스 호출 중심 |
| 댓글 기능 | `src/components/comments/`, `src/app/api/posts/[id]/comments/route.ts` | 가장 복잡한 UI 도메인 |
| 구독/사이드바 | `src/components/layout/SidebarTrackedPosts.tsx`, `src/components/posts/PostSubscriptionButton.tsx`, `src/lib/services/sidebar-tracked-posts-service.ts` | fallback 이벤트/로컬 상태 주의 |
| 인증/권한 | `src/auth.ts`, `src/auth.config.ts`, `src/lib/active-user.ts`, `src/lib/admin-auth.ts` | pending/banned/role 분기 확인 |
| 링크 프리뷰/보안 | `src/lib/link-preview/`, `src/lib/network-guard.ts` | 외부 URL 처리 전 보안 가드 필수 |
| 실시간/푸시 | `src/lib/realtime/`, `src/lib/push.ts`, `.github/workflows/push-dispatch.yml` | 브라우저 + 스케줄러 둘 다 관여 |
| 로컬/배포 점검 | `scripts/setup-local.mjs`, `scripts/check-deploy-readiness.mjs`, `README.md` | Turso/Blob/env 검증 흐름 |

## 코드 맵

| 심볼 | 종류 | 위치 | 역할 |
|------|------|------|------|
| `Home` | page | `src/app/page.tsx` | 인증된 홈 피드 진입점 |
| `GET` / `POST` | route | `src/app/api/posts/route.ts` | 포스트 목록/작성 API |
| `MainLayout` | component | `src/components/layout/MainLayout.tsx` | 헤더/사이드바/도구 모음 배치 |
| `CommentSection` | component | `src/components/comments/CommentSection.tsx` | 댓글 스트림, 실시간, 스크롤, read marker 중심 |
| `listPosts` | service | `src/lib/services/posts-service.ts` | 피드 검색/캐시/overlay 집계 |
| `getPostDetail` | service | `src/lib/services/post-detail-service.ts` | 상세/댓글 초기 트리/읽음 동기화 |
| `listSidebarTrackedPosts` | service | `src/lib/services/sidebar-tracked-posts-service.ts` | 사이드바 추적 포스트 계산 |
| `authConfig` | auth | `src/auth.ts` | Credentials 로그인/JWT 세션 |
| `proxy` | middleware | `src/proxy.ts` | `/post/*` 리다이렉트, admin/profile 보호 |

## 컨벤션

- 상위 워크스페이스 `AGENTS.md` 규칙 우선 적용.
- TypeScript `strict` 유지. 경로 alias는 `@/* -> src/*`.
- `build`는 항상 `prisma generate && next build` 포함. Prisma 변경 시 build 영향 고려.
- 테스트는 `src/__tests__/**/*.test.{ts,tsx}` + `e2e/*.spec.ts` 이원화.
- 루트 lint는 `보고서/`, `AGENTS.md`, `.agent/`, `legacy/`, `src/generated/` 무시.
- 로컬 기본 DB는 `file:./dev.db`. 프로덕션은 Turso(libsql) 가정.
- 배포 전 DB/푸시 준비 상태 확인은 `npm run check:deploy -- --with-db` 기준.
- `보고서/ARCHITECTURE_REVIEW.md`는 활성 참고 문서지만 `보고서/신문고사이트.md`는 제거된 기능 기록임.

## 이 프로젝트 안티패턴

- `src/app/api/`에서 비즈니스 로직을 길게 늘어놓는 패턴 금지. 서비스/유틸로 내릴 것.
- `deletedAt` 체크 빠뜨리고 포스트/유저를 직접 조회하는 패턴 금지.
- 외부 URL, 링크 프리뷰, 서버 주소 검사에서 `network-guard` 우회 금지.
- 푸시/구독/사이드바 로직 수정 시 stale schema fallback(`db-schema-guard`) 무시 금지.
- 테스트 없이 댓글/구독/알림 경로 리팩터링 금지. 회귀 범위 큼.
- `scripts/migrate-*` 계열을 dry-run 없이 바로 실DB에 적용하는 패턴 금지.

## 자주 쓰는 명령

```bash
npm run setup
npm run doctor
npm run dev
npm run lint
npm test
npm run test:e2e
npm run build
npm run check:deploy -- --with-db
```

## 노트

- Playwright는 Chromium만 사용.
- `setup-local.mjs`가 `.env.local` 생성, `NEXTAUTH_SECRET` 자동 생성, Prisma setup, Playwright 설치까지 체인 실행.
- 한글 경로 `보고서/` 존재. 도구/스크립트 작성 시 UTF-8 경로 처리 주의.
- `auth/profile`, `auth/password`, `auth/reauth` 일부 구 API는 `410 gone` 반환하는 호환 레이어 유지.
