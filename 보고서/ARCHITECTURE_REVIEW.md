# CrafterForumWeb_NextJS 아키텍처 리뷰

## 0. 리뷰 범위
- 대상: `CrafterForumWeb_NextJS`
- 기준: `src/app`, `src/components`, `src/app/api`, `src/lib`, `src/auth*`, `src/proxy.ts`, `prisma/schema.prisma`
- 레거시 비교 기준: `legacy/` (동작 참고용)
- 최종 검증일: 2026-02-12

### 최신 검증 커맨드
- `npm run lint` -> 성공 (`0 warnings, 0 errors`)
- `npm test` -> 성공 (`25 files, 100 tests passed`)
- `npm run build` -> 성공 (Turbopack production build 완료)
- `npx next build --webpack` -> 이번 회차 미실행 (직전 실패 이력: 2026-02-12, 원인 재수집 필요)
- `npm run dev` -> 단독 실행 미검증 (단, `npm run test:e2e`의 `webServer` 구동은 성공)
- `npm run test:e2e` -> 성공 (`5 passed`)
- `npm run db:migrate:turso -- --force` -> 이번 회차 미실행 (직전 성공 이력: 2026-02-11)

## 1. 한눈에 보는 구조
이 프로젝트는 Next.js App Router 기반 단일 저장소 BFF 구조

- 프론트엔드: `src/app`, `src/components`
- 백엔드 API: `src/app/api/**/route.ts`
- 인증/인가: `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/lib/admin-auth.ts`
- 데이터: Prisma (`prisma/schema.prisma`) + DB 어댑터 분기
  - local: SQLite (`prisma/dev.db`)
  - production: Turso(libSQL)
- 공통 서비스: `src/lib/*` (rate limit, session id normalize, comments DTO/ops, embed pipeline, user service)

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
    admin-auth.ts         # 관리자 인가 공통 가드
    rate-limit.ts         # 공통 레이트리밋 엔진
    rate-limit-policies.ts# 정책 값 분리
    comments.ts           # 댓글 DTO 트리 계약
    comment-stream.ts     # 댓글 연속 compact 스트림 로직
    comment-tree-ops.ts   # 댓글 트리 불변 조작 유틸
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
- 레거시 `/post/[id]`는 호환 redirect 레이어로만 유지
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

### 5.1 레거시 2번 항목 반영 현황 (2026-02-12 재확인)
- 반영 완료: #3, #7, #10, #12, #13, #14
- 미완료 또는 재검증 필요: #1, #2, #4, #5, #6, #8, #9, #11

## 6. 현재 리스크 평가

### High
1. Turso 토큰 회전 필요
- 이관 과정에서 토큰이 채팅 로그에 노출됨
- Turso 토큰 재발급 후 Vercel env 동기화 필요

### Medium
1. 프로덕션 CWV 재측정 필요
- 인증 페이지 렌더 구조는 경량화했지만, Vercel 실측 FCP/LCP/CLS 재수집으로 개선폭 확인 필요

## 7. 우선순위 제안
1. Vercel Web Vitals(FCP/LCP/CLS)를 인증 페이지 기준으로 재측정하고 개선값 기록
2. Turso 토큰 회전 및 배포 환경 변수 동기화
3. `npx next build --webpack` fallback 경로 재검증으로 빌드 이중화 신뢰도 확보

## 8. 결론
핵심 백엔드 구조(인증/인가, API 계약, 레이트리밋, 관리자 운영 플로우)는 안정화 상태를 유지
이번 회차에서 Medium 1,2,3(`no-img-element`, deprecated `/api/auth/password` bridge 상태, `allowedDevOrigins` 경고)을 모두 해소
현재 우선 리스크는 기능 결함보다 운영 품질 항목(토큰 회전, 실측 CWV 추적)에 집중됨
