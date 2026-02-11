# CrafterForumWeb_NextJS 아키텍처 리뷰

## 0. 리뷰 범위
- 대상: `CrafterForumWeb_NextJS`
- 기준: `src/app`, `src/components`, `src/app/api`, `src/lib`, `src/auth*`, `src/middleware.ts`, `prisma/schema.prisma`
- 레거시 비교 기준: `legacy/` (동작 참고용)
- 최종 검증일: 2026-02-11

### 최신 검증 커맨드
- `npm run lint` -> 미재검증 (마지막 전체 결과: 실패, `267 problems: 153 errors, 114 warnings`)
- `npm test` -> 성공 (`19 files, 58 tests passed`)
- `npm run build` -> 성공 (Next.js 16.1.6 Turbopack)
- `npm run test:e2e` -> 미재검증 (마지막 전체 결과: 실패, `libnspr4.so` 런타임 라이브러리 누락으로 Chromium launch 실패)
- `npm run db:migrate:turso -- --force` -> 성공 (SQLite -> Turso 이관 완료, FK 깨진 `PostRead` 4건 제외)

## 1. 한눈에 보는 구조
이 프로젝트는 Next.js App Router 기반 단일 저장소 BFF 구조

- 프론트엔드: `src/app`, `src/components`
- 백엔드 API: `src/app/api/**/route.ts`
- 인증/인가: `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`, `src/lib/admin-auth.ts`
- 데이터: Prisma (`prisma/schema.prisma`) + DB 어댑터 분기
  - local: SQLite (`prisma/dev.db`)
  - production: Turso(libSQL)
- 공통 서비스: `src/lib/*` (rate limit, session id normalize, comments DTO, user service)

## 2. 레이어 구성
```text
src/
  app/
    api/                  # Route Handler (BFF)
    admin/                # 관리자 페이지
    posts/, inquiries/    # 핵심 도메인 페이지
  components/             # 도메인 UI
  lib/                    # 공통 서버 유틸/서비스
    prisma.ts             # Prisma singleton
    database-url.ts       # DB URL 스킴 판별
    admin-auth.ts         # 관리자 인가 공통 가드
    rate-limit.ts         # 공통 레이트리밋 엔진
    rate-limit-policies.ts# 정책 값 분리
    comments.ts           # 댓글 DTO 트리 계약
    comment-stream.ts     # 댓글 연속 compact 스트림 로직
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
- `/api/auth/profile|password|reauth`는 deprecation wrapper로 축소 유지

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

### 5.1 레거시 2번 항목 반영 현황 (2026-02-11)
- 반영 완료: #3, #7, #10, #12, #13, #14
- 미완료 또는 재검증 필요: #1, #2, #4, #5, #6, #8, #9, #11

## 6. 현재 리스크 평가

### High
1. `npm run lint` 미통과
- `.agent/**`, `legacy/**`가 lint 스코프에 포함되어 에러 대량 유입
- 앱 코드에서도 `SidebarSettingsModal`의 `set-state-in-effect`, `no-explicit-any` 에러 잔존

2. E2E 게이트 미통과
- 실패 원인: Chromium 실행 시 `libnspr4.so` 누락
- 현재는 테스트 코드 품질이 아니라 런타임 의존성 이슈가 게이트를 막는 상태

3. Turso 토큰 회전 필요
- 이관 과정에서 토큰이 채팅 로그에 노출됨
- Turso 토큰 재발급 후 Vercel env 동기화 필요

### Medium
1. Next.js 16 `middleware` 컨벤션 deprecation 경고
- `src/middleware.ts` -> `proxy` 컨벤션 이관 필요

2. deprecated `auth/*` wrapper 제거 미완료
- 클라이언트 의존성 확인 후 제거 일정 확정 필요

## 7. 우선순위 제안
1. ESLint 범위를 앱 코드 중심(`src`, `e2e`)으로 재정의하고 `.agent`, `legacy`는 분리
2. `src/components/sidebar/SidebarSettingsModal.tsx` 고심각 lint 에러 우선 해결
3. E2E 실행 환경에 Playwright 필수 라이브러리(`libnspr4`) 설치 후 재검증
4. `middleware` -> `proxy` 마이그레이션 수행
5. deprecated `/api/auth/profile|password|reauth` 제거 계획 확정

## 8. 결론
핵심 백엔드 구조(인증/인가, API 계약, 레이트리밋, 관리자 운영 플로우)는 이전 대비 안정화됨
현재 유지보수 난이도를 끌어올리는 주원인은 기능보다 품질 게이트 환경(`lint` 스코프, E2E 런타임 의존성)이며, 이를 먼저 정리하면 개발/배포 속도가 크게 개선됨
