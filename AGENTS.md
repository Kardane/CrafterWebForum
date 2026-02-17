# CrafterWebForum AGENTS

최종 업데이트: 2026-02-18

## 1) 저장소 기준

- 현재 저장소는 단일 Next.js 16 + TypeScript 앱 기준
- 핵심 경로
  - UI: `src/app`, `src/components`
  - API: `src/app/api/**/route.ts`
  - 인증: `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`
  - 데이터: `prisma/schema.prisma`, `src/lib/prisma.ts`

## 2) 기본 실행 커맨드

루트(`CrafterWebForum`)에서 실행

- 초기 세팅
  - `npm run setup`
  - `npm run setup:local:skip-playwright`
- 개발/검증
  - `npm run dev`
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npx tsc --noEmit`
- 단일 테스트 실행 예시
  - `npm run test -- src/__tests__/components/PostStickyHeader.test.tsx`
  - `npm run test -- src/__tests__/components/CommentDateDividerRow.test.tsx`

## 3) 코딩 규칙

- TypeScript strict 유지
- 2-space indentation, semicolon 유지
- 컴포넌트 `PascalCase`, 함수/훅 `camelCase`
- API 응답 계약 변경 시 UI 소비 코드와 테스트를 함께 갱신
- 디버그 로그(`console.log`)는 마무리 전에 제거

## 4) 아키텍처 가드레일

- 게시글 canonical 경로는 `/posts/[id]`
- 레거시 `/post/*`는 redirect 호환만 유지
- `POST /api/posts` 포함 쓰기 API는 서버 세션 기반 actor 강제
- admin API는 `requireAdmin()` 공통 가드 사용
- PrismaClient는 `src/lib/prisma.ts` singleton만 사용
- 공개/남용 위험 API는 공통 레이트리밋 정책 사용

## 5) 댓글/포스트 UI 계약

- 댓글 섹션은 오케스트레이터 분리 구조 유지
  - `CommentSection` + `useCommentMutations` + `useCommentScroll`
- 날짜 구분선은 중앙 배지 + 양쪽 라인 구조 유지
  - 관련 클래스: `date-divider`, `divider-label`, `divider-line`
- 읽음 마커(`ReadMarkerRow`) 시각 계층과 날짜 구분선 계층을 혼동하지 않기
- 포스트 sticky 헤더는 아래 계약 유지
  - "맨 위" 버튼: 페이지 최상단 smooth scroll
  - "맨 아래" 버튼: `#comment-feed-end`로 smooth scroll

## 6) 보안/운영 규칙

- 비밀값 하드코딩 금지, `process.env.*` 기반 사용
- 입력 검증/출력 sanitization 유지
- 인증/인가 실패 메시지는 불필요한 내부 정보 노출 금지
- Turso 사용 시 `TURSO_AUTH_TOKEN` 필수

## 7) 테스트 규칙

- 변경된 동작에는 최소 1개 이상 회귀 테스트 추가
- UI 동작 변경 시 컴포넌트 테스트 우선 추가
- API 계약 변경 시 route 테스트 보강
- 배포 전 최소 게이트
  1) `npm run lint`
  2) `npm test`
  3) `npm run build`

## 8) 커밋/PR 규칙

- Conventional Commits 사용 (`feat:`, `fix:`, `refactor:` 등)
- 변경 이유(why) 중심 메시지
- 생성물/런타임 아티팩트 커밋 금지
  - `node_modules/`, `.next/`, `coverage/`, `test-results/`, `playwright-report/`
  - SQLite DB 파일, 로컬 로그, 비밀값 파일

## 9) 최근 반영 사항 (2026-02-18)

- Linux/WSL 기본 셋업 경로 정착
  - `scripts/setup-local.mjs` 추가
  - 루트 헬퍼 스크립트 상대경로 실행으로 정리
- 댓글 날짜 구분선 Discord 스타일로 개선
- PostStickyHeader에 댓글 맨 아래 이동 버튼 추가
- 관련 테스트 추가
  - `src/__tests__/components/PostStickyHeader.test.tsx`
- 메인/상세 진입 성능 최적화 1차 적용
  - `src/lib/services/posts-service.ts`: 목록 캐시를 공용 core + 사용자 overlay(좋아요/읽음)로 분리
  - `src/lib/services/post-detail-service.ts`: 상세 캐시 키에서 사용자 축 제거, `user_liked`를 사용자 overlay 쿼리로 분리
  - `src/proxy.ts`: 보호 경로가 아닌 요청은 `auth()`를 건너뛰도록 조정
