# CrafterWebForum 아키텍처 리뷰

## 0. 리뷰 범위
- 대상: `CrafterWebForum`
- 기준: `src/app`, `src/components`, `src/app/api`, `src/lib`, `src/auth*`, `src/proxy.ts`, `prisma/schema.prisma`
- 레거시 비교 기준: `legacy/` (동작 참고용)
- 최종 검증일: 2026-02-22

### 최신 검증 커맨드
- `npm run lint` -> 성공 (`0 warnings, 0 errors`)
- `npm test` -> 성공 (`35 files, 141 tests passed`)
- `npm run build` -> 성공 (Turbopack production build 완료)
- `npx next build --webpack` -> 성공 (`@prisma/adapter-libsql` import 체인 외부화 + Turbopack 병행 설정으로 fallback 빌드 복구)
- `npx tsc --noEmit` -> 성공
- `npm run dev` -> 단독 실행 미검증 (단, `npm run test:e2e`의 `webServer` 구동은 성공)
- `npm run test:e2e` -> 이번 회차 사용자 요청으로 스킵
- `npm run db:migrate:turso -- --force` -> 이번 회차 미실행 (직전 성공 이력: 2026-02-11)

## 1. 한눈에 보는 구조
이 프로젝트는 Next.js App Router 기반 단일 저장소 BFF 구조

- 프론트엔드: `src/app`, `src/components`
- 백엔드 API: `src/app/api/**/route.ts`
- 인증/인가: `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/lib/admin-auth.ts`
- 데이터: Prisma (`prisma/schema.prisma`) + DB 어댑터 분기
  - local: SQLite (`prisma/dev.db`)
  - production: Turso(libSQL)
- 공통 서비스: `src/lib/*` (rate limit, session id normalize, comments DTO/ops, embed pipeline, posts query service, server timing)

## 2. 레이어 구성
```text
src/
  app/
    api/                  # Route Handler (BFF)
    admin/                # 관리자 페이지
    posts/, inquiries/    # 핵심 도메인 페이지
  components/             # 도메인 UI
    auth/
      AuthShell.tsx               # 인증 페이지 공통 레이아웃 셸
      AuthShell.module.css        # 인증 페이지 공통 스타일
    ui/
      UserAvatar.tsx              # 공통 유저 아바타(fallback 체인)
    comments/
      CommentSection.tsx          # 댓글 오케스트레이터
      useCommentMutations.ts      # 댓글 API mutation 훅
      useCommentScroll.ts         # 댓글 스크롤/복원 훅
      PinnedCommentsModal.tsx     # 고정 댓글 목록 모달
      ReadMarkerRow.tsx           # 읽음 마커 행
      ThreadToggleRow.tsx         # 스레드 접기/펼치기 행
    sidebar/
      SidebarSettingsModal.tsx    # 사이드바 설정 오케스트레이터
      SettingsLinkItem.tsx        # 설정 링크 행
      AddLinkModal.tsx            # 커스텀 링크 추가 모달
  lib/                    # 공통 서버 유틸/서비스
    prisma.ts             # Prisma singleton
    database-url.ts       # DB URL 스킴 판별
    server-timing.ts      # Server-Timing 헤더 유틸
    admin-auth.ts         # 관리자 인가 공통 가드
    rate-limit.ts         # 공통 레이트리밋 엔진
    rate-limit-policies.ts# 정책 값 분리
    comments.ts           # 댓글 DTO 트리 계약
    comment-stream.ts     # 댓글 연속 compact 스트림 로직
    comment-tree-ops.ts   # 댓글 트리 불변 조작 유틸
    services/
      posts-service.ts        # 게시글 목록 쿼리 서비스
      post-detail-service.ts  # 게시글 상세 쿼리 서비스
    embeds/
      index.ts            # 임베드 파이프라인 진입점
      youtube.ts          # YouTube/Streamable 임베드
      external-card.ts    # 외부 링크 카드 렌더링
      media.ts            # 업로드/이미지 링크 처리
    session-user.ts       # 세션 ID 정규화
  constants/
    admin-trend.ts        # 관리자 추이 기간 옵션
  types/
    admin.ts              # 관리자 DTO 타입
prisma/
  schema.prisma
scripts/
  migrate-sqlite-to-turso.mjs # SQLite -> Turso 데이터 이전
legacy/                   # 레거시 동작 참조
보고서/                   # 로컬 문서/작업 노트
```

## 3. 백엔드 핵심 설계

### 3.1 인증/인가
- 사용자 인증: NextAuth credentials
- 쓰기 API actor identity: 요청 body 미신뢰, 서버 세션 기반 강제
- 관리자 인가: 모든 admin API에서 `requireAdmin()` 재사용
- `requireAdmin()` 보강: 세션에 `role`/`nickname` 누락 시 DB fallback 조회로 권한 판정 안정화

### 3.2 라우팅/계약
- 게시글 canonical 경로: `/posts/[id]`
- 레거시 경로 redirect 정책 고정:
  - `/post`, `/post/` -> `/`
  - `/post/[id]` -> `/posts/[id]`
- 댓글 계약 통일: `author` + `replies` 트리
- 계정 canonical API: `/api/users/me*`
- `/api/auth/me|profile|reauth`는 `410 Gone` tombstone 응답으로 전환
- `/api/auth/password`는 `410 Gone` tombstone 응답으로 고정

### 3.3 레이트리밋 공통화
- 공통 엔진: `src/lib/rate-limit.ts`
- 정책 분리: `src/lib/rate-limit-policies.ts`
- 적용 라우트: minecraft code/verify, auth register

### 3.4 관리자 운영 흐름
#### 통계
- `/api/admin/stats?range=...` 지원
- range: `3d`, `7d`, `14d`, `30d`, `90d`, `180d`
- 응답의 `coreTrend`는 일자별 누적값 (`users`, `posts`, `comments`)

#### 포스트/문의 삭제
- 1단계: `DELETE` 호출 시 아카이브 처리
  - Post: `deletedAt` 설정
  - Inquiry: `archivedAt` 설정
- 2단계: 아카이브된 항목만 `DELETE ?permanent=true`로 영구 삭제
- 복구: `PATCH { action: "restore" }`
- 리스트 정책:
  - 기본 목록은 active만 조회
  - 아카이브 목록은 `?archived=true`로 분리 조회

#### 백업
- 관리자 백업 경로를 `prisma/backups` 기준으로 정리
- Turso 환경에서는 `/api/admin/backup`를 비활성화하고 명시적으로 미지원 응답 반환

### 3.5 Turso 전환/이관
- Prisma 클라이언트에서 `DATABASE_URL` 스킴으로 DB adapter를 분기
  - `file:` -> SQLite direct
  - `libsql://`, `turso://` -> `@prisma/adapter-libsql`
- env 검증에서 Turso URL 사용 시 `TURSO_AUTH_TOKEN` 필수 강제
- 이관 스크립트 `scripts/migrate-sqlite-to-turso.mjs` 도입
  - `--dry-run`: 소스 건수 검증만 수행
  - `--force`: 대상 Turso DB 초기화 후 전체 이관
- 이관 결과
  - 대부분 테이블 100% 이전
  - FK 무결성 깨진 `PostRead` 4건은 안전하게 제외

### 3.6 메인/게시글 상세 성능 경로 최적화
- 배포 환경에서 `/`와 `/post/*` 로드 지연(4초+) 이슈를 기준으로 데이터 경로를 재설계
- `/`와 `/posts/[id]` 페이지의 내부 API self-fetch를 제거하고 서비스 레이어 직접 호출로 단일 DB hop 유지
- `src/lib/services/posts-service.ts`, `src/lib/services/post-detail-service.ts`를 API/페이지 공용 데이터 소스로 통일
- `/api/posts`, `/api/posts/[id]`에 `Server-Timing` 헤더를 추가해 병목 지점(쿼리/직렬화) 추적 가능 상태 확보
- 목록/상세 페이지와 관련 API에 `preferredRegion = "icn1"`를 명시해 배포 리전 일관성 확보

### 3.7 콘텐츠 렌더링 안정화
- 포스트 목록 미리보기에서 이미지 마크다운 원문(`![...](...)`)이 노출되지 않도록 정규화 순서를 보정
- 마크다운 렌더 시 이미지 앞뒤 불필요한 `<br>`를 제거해 이미지 다음 텍스트가 과도하게 벌어지지 않도록 보정
- 코드/텍스트 블록 미리보기는 최대 20줄까지만 렌더하고 초과분은 `...`로 절단
- 댓글 스트림의 날짜 구분선/`여기부터 새 댓글` 마커를 중앙 정렬형 라인 구조(`divider-line`)로 통일
- 프로필/사이드바 아바타는 `UserAvatar` 단일 컴포넌트로 통합하고 `mineatar -> mc-heads -> initials` fallback 체인 적용
- 본문 외부 링크 카드 이미지 로드 실패 시 카드 레이아웃이 깨지지 않도록 안전한 숨김 처리 적용

### 3.8 이미지 모달 계측/최적화
- 이미지 확대 모달을 `ImageLightboxProvider` 단일 인스턴스로 통합해 본문/댓글 `PostContent` 다중 렌더 시 모달 중복 마운트 비용을 제거
- `PostContent` 마크다운/임베드 렌더 결과를 `useMemo`로 캐시해 동일 content 재렌더 시 문자열 파이프라인 재실행 비용을 완화
- 이미지 에러 핸들링을 개별 `img.onerror` 할당에서 이벤트 위임(`error` capture listener)으로 변경해 DOM 노드 수가 많을 때 핸들러 부하를 완화
- `ImageLightboxProvider`에서 경량 성능 로깅을 추가해 아래 지표를 콘솔로 수집
  - `modalOpenP95Ms`: 클릭 후 모달 첫 프레임 p95
  - `imageLoadP95Ms`: 클릭 후 이미지 `onLoad` 완료 p95
  - `longTaskCount`, `longTaskMaxMs`: 모달 오픈 구간 long task 빈도/최대 구간
  - 샘플은 최근 120건 bounded 유지

### 3.9 링크/폴링/사이드바 최적화 2차
- `MinecraftReauth`에서 코드 발급/폴링 fetch 각각에 `AbortController`를 연결해 언마운트 및 다음 폴링 주기 시작 시 이전 요청을 즉시 취소
- `/api/link-preview`에 URL 단위 in-memory TTL 캐시(`Map + expiresAt`)를 추가해 동일 링크 반복 조회 시 외부 upstream 호출을 생략
- `Sidebar`의 관리자 문의 카운트 조회에 30초 TTL 캐시와 `visibilitychange` 기반 재검증을 추가해 `no-store` 반복 호출 빈도를 완화
- `PostContent` 외부 링크 카드 메타 렌더 루프를 chunk 단위 incremental 처리(`requestAnimationFrame`)로 분해해 대량 카드 DOM 업데이트 시 단일 프레임 블로킹을 축소
- `/api/link-preview` TTL 캐시 재사용 경로를 `src/__tests__/api/link-preview.route.test.ts`로 회귀 보호

## 4. 데이터 레이어 상태

### 4.1 모델/상태 필드
- `Post.deletedAt`: 소프트 삭제/아카이브
- `Inquiry.archivedAt`: 문의 아카이브
- `User.deletedAt`: 사용자 소프트 삭제
- `MinecraftCode`: 가입/재인증 코드 DB 기반 TTL/검증

### 4.2 접근 규칙
- PrismaClient는 `src/lib/prisma.ts` singleton만 사용
- Turso 사용 시 `@prisma/adapter-libsql`로 연결하고 `TURSO_AUTH_TOKEN` 존재를 런타임에서 검증
- 세션 사용자 ID는 `toSessionUserId()`로 정규화 후 DB 접근

### 4.3 조회 성능 인덱스
- `Post`: `@@index([deletedAt, updatedAt])` 추가로 메인 목록(soft-delete 제외 + 최신순) 조회 비용 완화
- `Comment`: `@@index([postId, createdAt])` 추가로 게시글 상세 댓글 시계열 조회 비용 완화

## 5. 최근 완료된 유지보수 개선
1. 게시글 생성 API의 서버측 actor derivation 강제
2. 댓글 DTO 계약 통일 (`author` + `replies`)
3. Prisma singleton 일원화
4. 계정 API canonical 라인 `/api/users/me*` 통일
5. 마인크래프트 재인증 코드 DB 전환
6. 레이트리밋 공통 엔진/정책 분리
7. 관리자 닉네임 정책 모듈화 (`ADMIN_NICKNAMES`)
8. 게시글/댓글/좋아요 라우트 세션 ID 정규화
9. `/post/*` 레거시 경로 의존 제거 + canonical redirect 유지
10. 관리자 대시보드 일자별 누적 선그래프 + 기간 필터 추가
11. 관리자 포스트/문의 아카이브-복구-영구삭제 2단계 흐름 반영
12. 관리자 통계/문의 로딩 오류 대응 (`requireAdmin` fallback, auth 실패 분기 정리)
13. 관리자 통계/문의 API 회귀 테스트 추가
14. 댓글 compact 체인 로직 공통화 및 최대 연속 5개 제한
15. 댓글 작성 시 composer 높이 동적 reserve로 푸터 가림 현상 수정
16. 댓글 푸터 `+` 메뉴 오픈 방향/마크다운 `hr` 여백 UX 보정
17. Turso adapter 연동 + env 검증 강화 (`TURSO_AUTH_TOKEN` 필수)
18. SQLite -> Turso 강제 이관 스크립트 추가 및 실데이터 이전 완료
19. 업로드 검증 계약 확장 (`image | video | file`) 및 MIME/확장자 불일치 차단 강화
20. 업로드 API/에디터 반영: 영상 업로드를 이미지가 아닌 비디오 링크로 처리
21. 댓글 작성창 `ArrowUp` 단축키로 마지막 본인 댓글 수정 진입 지원
22. 모바일 인증 페이지(`/login`, `/register`, `/pending`) 하단 safe-area 패딩 보강
23. 프로필/댓글 아바타 로딩에 후보 URL fallback(`mineatar -> mc-heads`) 공통화
24. 마크다운 블록 전환 구간의 과도한 `<br>` 정규화 처리
25. 회귀 테스트 보강 (`upload`, `embeds`, `markdown` 관련 단위 테스트 추가/확장)
26. 댓글 섹션 책임 분리: 오케스트레이션/스크롤/뮤테이션/행 컴포넌트 모듈화
27. 댓글 트리 연산 순수 함수(`comment-tree-ops`) 분리 + 단위 테스트 21건 추가
28. 사이드바 설정 모달 분리 (`SettingsLinkItem`, `AddLinkModal`)로 컴포넌트 복잡도 완화
29. 임베드 처리기를 `src/lib/embeds/*`로 분리하고 기존 `src/lib/embeds.ts`를 호환 re-export로 유지
30. deprecated `/api/auth/me|profile|reauth`를 `410 Gone` 정책으로 전환하고 회귀 테스트 반영
31. 인증 페이지 공통 셸(`AuthShell`) 도입으로 `/login`, `/register`, `/forgot-password`, `/pending`의 중복 inline 스타일 제거
32. 인증 배경/로고를 `next/image` 기반으로 전환하고 고정 치수/`sizes`/`quality`로 CLS 리스크 완화
33. `MainLayout`의 auth 레이아웃 분기 확대 (`/pending`, `/auth/*` 포함)로 인증 UX 일관성 강화
34. `next.config.ts` 이미지 최적화 설정 보강 (`formats: avif/webp`, `qualities: [62, 75]`)
35. `SafeImage` 공통 컴포넌트 도입 및 주요 화면 `<img>` 8건을 `next/image` 기반으로 치환해 lint 경고 제거
36. `/api/auth/password` 정책을 bridge가 아닌 `410 Gone` tombstone 고정 상태로 문서/테스트 기준 일치화
37. `next.config.ts`에 `allowedDevOrigins: ["127.0.0.1", "localhost"]`를 추가해 dev/e2e 교차 origin 경고 제거
38. Windows 네이티브 개발 전환을 위한 `setup:win`/doctor/db-setup 스크립트 체계화 및 `.env.example`/README 정리
39. `/`와 `/posts/[id]` 페이지에서 내부 API self-fetch 제거, 서비스 레이어 직접 호출로 왕복 지연 최소화
40. `/api/posts`, `/api/posts/[id]`를 서비스 레이어 공용화 + `Server-Timing` 계측 추가
41. `src/proxy.ts`에서 legacy redirect를 강화해 `/post`, `/post/`, `/post/[id]` canonical 경로 고정
42. `src/__tests__/proxy.redirects.test.ts` 추가로 legacy redirect 회귀 보호
43. `src/__tests__/api/post-detail.route.test.ts` 보강으로 read sync 상태에서 불필요한 `postRead.upsert` 생략 보장
44. `prisma/schema.prisma`에 목록/상세 조회 경로용 인덱스(`Post`, `Comment`) 추가
45. 포스트 목록 미리보기 정규화 보강으로 이미지 마크다운 원문 노출 이슈 수정
46. 마크다운 렌더 단계에서 이미지 인접 불필요 `<br>` 제거
47. 코드/텍스트 블록 미리보기를 20줄 제한 + `...` 절단 정책으로 통일
48. 댓글 날짜 구분선/읽음 마커를 중앙 라인 구조(`divider-line`)로 개편
49. `UserAvatar` 공통 컴포넌트 도입 및 사이드바 프로필 아바타 렌더링 통합
50. `PostContent` 외부 링크 카드 이미지 `onerror` 방어 로직 추가
51. 렌더링 회귀 테스트 보강(`utils`, `markdown`, `CommentDateDividerRow`, `ReadMarkerRow`, `UserAvatar`)
52. `next.config.ts`에 `serverExternalPackages`/`turbopack` 설정을 보강해 `npx next build --webpack` fallback 빌드 경로 복구
53. `src/lib/cache-tags.ts` 도입으로 posts 목록/상세 캐시 태그를 일원화하고, 쓰기 API에서 `safeRevalidateTags()` 기반 무효화 정책 적용
54. `/api/posts/meta`에 ETag 및 `If-None-Match` 조건부 `304 Not Modified` 응답을 추가해 동일 요청 payload 재전송 비용 절감
55. `PostContent` 메타 fetch에 이전 ETag 재사용(`If-None-Match`)을 적용해 `304` 응답 시 캐시 데이터 재활용 경로 확보
56. Linux/WSL 기본 셋업 경로 도입: `scripts/setup-local.mjs` 추가, 루트 헬퍼 스크립트(`setup.sh`, `run_dev.sh`, `run_test_wsl.sh`, `npm_wsl.sh`)를 저장소 상대경로 실행으로 정리
57. 댓글 날짜 구분선을 Discord 스타일 중앙 배지 + 양쪽 라인 구조로 개편하고 sticky 헤더에 "맨 아래" 버튼(`comment-feed-end` smooth scroll) 추가
58. 회귀 테스트 보강: `src/__tests__/components/PostStickyHeader.test.tsx` 추가로 하단 이동 버튼 렌더/동작 보장
59. `src/lib/services/posts-service.ts`를 공용 코어 캐시 + 사용자 오버레이(좋아요/읽음) 구조로 분리해 사용자별 캐시 파편화 완화
60. `src/lib/services/post-detail-service.ts` 상세 캐시 키에서 사용자 축 제거, `user_liked`를 사용자별 보조 쿼리로 분리
61. `src/proxy.ts`에서 비보호 경로 요청은 `auth()`를 건너뛰게 해 초기 진입 인증 오버헤드 감소
62. 목록 오버레이 분리 경로 회귀 보호를 위해 `src/__tests__/api/posts.list.route.test.ts` mock 경로(`postRead.findMany`) 보강
63. `src/components/ui/ImageLightboxProvider.tsx` 도입으로 이미지 확대 모달을 전역 단일 인스턴스로 통합하고 클릭-오픈/이미지 로드/long task 경량 계측(`p95`) 추가
64. `src/components/posts/PostContent.tsx`에 `useMemo` 기반 마크다운/임베드 캐시 및 이미지 에러 이벤트 위임 처리 적용
65. `src/lib/perf-metrics.ts` 및 `src/__tests__/lib/perf-metrics.test.ts` 추가로 bounded 샘플/percentile 계산 유틸과 회귀 테스트 보강
66. `src/components/profile/MinecraftReauth.tsx`에 코드 발급/폴링 요청 취소(`AbortController`)를 추가해 언마운트 후 잔여 요청 누수 방지
67. `src/app/api/link-preview/route.ts`에 URL 단위 TTL 메모리 캐시(`expiresAt`, 최대 엔트리 제한) 도입으로 중복 외부 호출 감축
68. `src/components/layout/Sidebar.tsx`의 `/api/inquiries/pending-count` 조회에 30초 TTL 캐시 + `visibilitychange` 재검증 추가
69. `src/components/posts/PostContent.tsx` 외부 링크 카드 메타 적용을 chunk 단위 incremental 렌더로 분해
70. `src/__tests__/api/link-preview.route.test.ts`에 동일 URL 재요청 시 TTL 캐시 재사용 회귀 테스트 추가

### 5.1 레거시 2번 항목 반영 현황 (2026-02-17 재확인)
- 반영 완료: #3, #7, #10, #12, #13, #14
- 미완료 또는 재검증 필요: #1, #2, #4, #5, #6, #8, #9, #11

## 6. 현재 리스크 평가

### High
1. Turso 토큰 회전 필요
- 이관 과정에서 토큰이 채팅 로그에 노출됨
- Turso 토큰 재발급 후 Vercel env 동기화 필요

### Medium
1. 프로덕션 메인/상세 실측 재검증 필요
- `/`와 `/posts/[id]` 기준으로 self-fetch 제거, 캐시 태그 무효화, `/api/posts/meta` 조건부 `304`, 목록/상세 캐시의 user 축 분리까지 적용 완료
- 배포 반영 후 `/`, `/posts/[id]`의 FCP/LCP/TTFB, `Server-Timing`, `/api/posts/meta` 304 hit 비율을 재수집해 개선폭 확인 필요
2. E2E 단일 시나리오 플래키 리스크
- `e2e/posts.spec.ts`의 `/inquiries` 접근 케이스가 간헐적으로 `page.goto ... ERR_ABORTED` 타임아웃을 보일 수 있음
- 이번 회차는 사용자 요청으로 e2e를 스킵했으므로 배포 전 재측정/재현 검증 필요

## 7. 우선순위 제안
1. 성능 개선 커밋 배포 후 `/`, `/posts/[id]` 실측(Web Vitals + `Server-Timing`)과 캐시 태그 무효화/`/api/posts/meta` 304 hit를 함께 재검증
2. `/inquiries` E2E 단일 실패(`ERR_ABORTED`)의 재현 조건 수집 및 테스트 안정화
3. Turso 토큰 회전 및 배포 환경 변수 동기화

## 8. 결론
핵심 백엔드 구조(인증/인가, API 계약, 레이트리밋, 관리자 운영 플로우)는 안정화 상태를 유지
이번 회차에서 메인/게시글 상세 데이터 경로 최적화에 캐시 태그 무효화, `/api/posts/meta` ETag 기반 조건부 응답, 목록/상세 캐시의 사용자 축 분리까지 결합해 재조회 비용을 추가로 낮춤
현재 우선 리스크는 운영 검증 항목(프로덕션 실측 재수집, `/inquiries` E2E 안정화, 토큰 회전)에 집중됨
