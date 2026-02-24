# CrafterWebForum AGENTS
답변 한국어로 해.
최종 업데이트: 2026-02-24

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
  - `git log -1 --pretty=format:'%h | %an <%ae> | %s'`
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
- 성능 계측 유틸 변경 시 `src/__tests__/lib/perf-metrics.test.ts` 회귀 확인

## 8) 커밋/PR 규칙

- Conventional Commits 사용 (`feat:`, `fix:`, `refactor:` 등)
- 변경 이유(why) 중심 메시지
- Vercel 자동 배포 사용 시 push 전 최신 커밋 author/email를 GitHub 계정과 일치시키기
  - 확인: `git log -1 --pretty=format:'%an <%ae>'`
  - 로컬 설정: `git config user.name "..."`, `git config user.email "..."`
- 생성물/런타임 아티팩트 커밋 금지
  - `node_modules/`, `.next/`, `coverage/`, `test-results/`, `playwright-report/`
  - SQLite DB 파일, 로컬 로그, 비밀값 파일

## 9) 최근 반영 사항 (2026-02-24)

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
- 이미지 모달 최적화 1차 반영
  - `src/components/ui/ImageLightboxProvider.tsx`: 전역 단일 인스턴스 라이트박스 + 경량 계측(`modalOpenP95Ms`, `imageLoadP95Ms`, long task)
  - `src/components/posts/PostContent.tsx`: `useMemo` 기반 마크다운/임베드 캐시 + 이미지 에러 이벤트 위임
  - `src/lib/perf-metrics.ts`: bounded 샘플/percentile 유틸 추가
  - `src/__tests__/lib/perf-metrics.test.ts`: 회귀 테스트 4건 추가
 - 이미지/링크 렌더링 최적화 2차 반영
  - `src/components/profile/MinecraftReauth.tsx`: 코드 발급/폴링 fetch에 `AbortController` 적용
  - `src/app/api/link-preview/route.ts`: URL 단위 TTL 메모리 캐시(`expiresAt`) 추가
  - `src/components/layout/Sidebar.tsx`: 관리자 문의 카운트 30초 TTL 캐시 + visibility 기반 재검증
  - `src/components/posts/PostContent.tsx`: 외부 링크 카드 메타 렌더를 chunk 단위 incremental 처리
  - `src/__tests__/api/link-preview.route.test.ts`: TTL 캐시 재사용 회귀 테스트 추가
 - 실시간 멘션 알림 + 브라우저 알림 반영
  - `prisma/schema.prisma`: `Notification` 모델 추가
  - `src/app/api/notifications/*`: 알림 목록/읽음 처리 API 추가
  - `src/app/api/posts/[id]/comments/route.ts`: `@닉네임` 멘션 파싱 후 알림 저장/실시간 브로드캐스트
  - `src/components/notifications/useNotifications.ts`: 실시간 알림 배지 + 브라우저 Notification API 연동
  - `src/app/notifications/page.tsx`: 알림 페이지 추가
 - 포스트 상세/댓글 레이아웃 폭 동기화
  - `src/app/posts/[id]/page.tsx`: 상세 페이지 좌우 패딩을 단계별(`px-3`, `md:px-5`, `lg:px-7`, `xl:px-12`, `2xl:px-16`)로 재조정하고 댓글 섹션 음수 마진 제거
  - `src/components/comments/CommentSection.tsx`: composer-dock 폭을 헤더 실측값과 동기화(`headerRef` + `ResizeObserver`)해 댓글 입력창/헤더/콘텐츠 폭 일치
  - `src/__tests__/components/CommentSection.composerDock.test.tsx`: 헤더 좌우 inset 기반 dock 정렬 회귀 테스트 추가
- 날짜 구분선 가시성 보강
  - `src/components/comments/CommentDateDividerRow.tsx`: 중앙 라벨 양옆 라인을 `borderTop` 기반으로 고정해 테마/배경에 관계없이 노출 안정화
 - 댓글 실시간/렌더링 최적화 3차 반영
  - `src/components/comments/CommentSection.tsx`: 실시간 이벤트 처리에서 생성/수정/삭제/고정을 가능한 범위에서 부분 업데이트로 반영하고, 실패/불일치 케이스만 fallback 재조회
  - `src/components/comments/CommentSection.tsx`: 행 래퍼(`.comment-row`)에 `content-visibility: auto` + `contain-intrinsic-size`를 적용해 대량 댓글 구간 렌더 비용 완화
  - `src/lib/realtime/useRealtimeBroadcast.ts`: 핸들러 ref 패턴으로 채널 재구독 churn을 줄여 렌더당 재구독 오버헤드 완화
 - 인증/프로필 네트워크 최적화
  - `src/app/register/page.tsx`, `src/app/forgot-password/page.tsx`: 제출 fetch에 `AbortController` 연결 및 언마운트/중복 제출 시 요청 취소
  - `src/app/profile/page.tsx`: `window.location.reload()` 재시도를 상태 기반 재요청(`retryTick`)으로 전환하고 fetch abort cleanup 추가
 - 포스트 콘텐츠/링크 프리뷰 계측 최적화
  - `src/lib/post-content-hydrator.ts`: 외부 링크 카드 수집을 단일 DOM 스캔으로 통합
  - `src/app/api/link-preview/route.ts`: 캐시 hit/miss + build + total `Server-Timing` 헤더 계측 추가
  - `src/__tests__/api/link-preview.route.test.ts`: `Server-Timing`의 cache hit/miss 노출 회귀 테스트 추가

## 10) 다음 최적화 후보

- P0: `src/components/comments/CommentSection.tsx`에서 생성 이벤트 fallback 재조회 비율을 낮추도록 parent 미존재 케이스의 버퍼링/지연 병합 전략 검토
- P1: `src/components/comments/CommentSection.tsx`의 `content-visibility` 적용 구간에서 브라우저별 스크롤 점프/anchor 복원 실측 확인
- P1: `src/components/posts/PostContent.tsx`의 highlight/메타 hydrate 구간에 샘플링 계측을 추가해 대형 본문 p95 추적
- P2: `src/app/api/link-preview/route.ts`의 `Server-Timing` 메트릭을 운영 대시보드(Web Vitals/로그 파이프라인)와 연동
