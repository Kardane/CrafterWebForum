# CrafterWebForum 아키텍처 리뷰

- 작성일: 2026-03-05
- 범위: `CrafterWebForum` 전체(코드 변경 없음, 문서 재작성)
- 기준 소스: `src/app`, `src/app/api`, `src/components`, `src/lib`, `prisma/schema.prisma`, `vitest.config.ts`, `playwright.config.ts`

## 1. 시스템 개요

CrafterWebForum는 **Next.js App Router 기반 단일 저장소 BFF 구조**임.

- UI 레이어: `src/app`, `src/components`
- API/BFF 레이어: `src/app/api/**/route.ts`
- 도메인/서비스 레이어: `src/lib/services/*`, `src/lib/*`
- 인증/세션 레이어: `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`
- 데이터 레이어: Prisma + SQLite/Turso (`src/lib/prisma.ts`, `prisma/schema.prisma`)

## 2. 정량 현황(근거 포함)

| 항목 | 값 | 근거 |
|---|---:|---|
| API Route 수 | 45 | `find src/app/api -type f -name 'route.ts' | wc -l` |
| 테스트 파일 수 | 47 | `find src/__tests__ -type f | wc -l` |
| 레이트리밋 적용 Route 수 | 10 | `rg -l "enforceRateLimit\(" src/app/api` |
| 주요 대형 API 파일 | 473 LOC | `src/app/api/posts/[id]/comments/route.ts` |
| 주요 대형 lib 파일 | 614 LOC | `src/lib/link-preview/providers.ts` |
| 주요 대형 UI 파일 | 1057 LOC | `src/components/comments/CommentSection.tsx` |

### 레이트리밋 적용 라우트 분포

- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/auth/password/forgot/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/link-preview/route.ts`
- `src/app/api/minecraft/code/route.ts`
- `src/app/api/minecraft/status/route.ts`
- `src/app/api/minecraft/verify/route.ts`
- `src/app/api/push/subscribe/route.ts`
- `src/app/api/push/unsubscribe/route.ts`
- `src/app/api/server-address/check/route.ts`

## 3. 레이어/데이터 흐름 리뷰

### 3.1 인증·인가 흐름

- 로그인은 NextAuth Credentials Provider 기반
- 사용자 조회/비밀번호 검증/JWT 세션 설정은 `src/auth.ts:26-66`, `src/auth.ts:78-105`에서 처리
- 관리자 권한 체크는 `requireAdmin()` 공통 함수로 분리되어 재사용됨 (`src/lib/admin-auth.ts:8-39`)

평가:

- 장점: 관리자 API 인증 경로가 공통화되어 정책 일관성이 높음
- 부채: 승인/차단 상태 체크가 라우트별로 불균일함(상세는 취약점 문서에 별도 정리)

### 3.2 게시글/댓글 흐름

- 목록: `src/app/api/posts/route.ts` -> `src/lib/services/posts-service.ts`
- 상세: `src/app/api/posts/[id]/route.ts` -> `src/lib/services/post-detail-service.ts`
- 댓글 API: `src/app/api/posts/[id]/comments/route.ts`

평가:

- 장점: 목록/상세 조회 로직을 서비스 레이어로 분리해 API와 페이지 간 재사용이 가능함
- 부채: 댓글 트리 조립이 BFS 다중 쿼리 구조라 깊은 스레드에서 DB 왕복이 증가함 (`src/app/api/posts/[id]/comments/route.ts:233-252`, `src/lib/services/post-detail-service.ts:116-135`)

### 3.3 캐시/리얼타임 흐름

- 목록/상세 조회 캐시: `unstable_cache` 기반 (`src/lib/services/posts-service.ts`, `src/lib/services/post-detail-service.ts`)
- 링크 프리뷰 캐시: 메모리 TTL Map (`src/lib/link-preview/cache.ts`)
- 리얼타임 브로드캐스트: Supabase Realtime HTTP 브로드캐스트 (`src/lib/realtime/server-broadcast.ts:19-47`)

평가:

- 장점: 캐시 태그/Server-Timing이 일부 경로에 반영되어 관측성이 있음
- 부채: 인메모리 캐시/레이트리밋은 멀티 인스턴스에서 정합성 보장이 어려움

## 4. 테스트/운영 현황

### 4.1 테스트 구성

- 단위/통합: Vitest (`vitest.config.ts`)
- E2E: Playwright (`playwright.config.ts`)
- 테스트 대상 include: `src/__tests__/**/*.test.{ts,tsx}`

### 4.2 운영 진단 제약

현재 세션에서는 `npm lint/test/build`를 실행 검증하지 못했음.

- 원인: Node/npm 실행 경로가 WSL/Windows 경계에서 충돌
- 증상: `eslint` 실행 시 UNC 경로/CMD fallback 오류, `npx` 실행 시 Node install 경로 인식 실패

## 5. 구조적 강점

- 관리자 권한 검증 공통화(`requireAdmin`)로 고위험 경로가 일정 수준 통제됨
- 서비스 레이어(`src/lib/services`) 도입으로 조회 책임 분리가 비교적 명확함
- 도메인별 유틸 분할(`src/lib/embeds`, `src/lib/realtime`, `src/lib/link-preview`)이 유지보수에 유리함
- `prisma/schema.prisma` 모델이 기능 도메인(포스트/댓글/알림/문의/푸시)을 충분히 포괄함

## 6. 구조적 기술부채

- 초대형 파일 집중
  - `src/components/comments/CommentSection.tsx` (1057 LOC)
  - `src/lib/link-preview/providers.ts` (614 LOC)
  - `src/app/api/posts/[id]/comments/route.ts` (473 LOC)
- Route 단위 입력 검증 방식이 일관되지 않음(zod 기반/수동 파싱 혼재)
- 레이트리밋/캐시가 인메모리 중심이라 수평 확장 시 정책 일관성 저하 가능성 존재
- 조회 API 일부에 페이지네이션 부재(`admin/users`, `admin/posts`, `admin/inquiries`)

## 7. 우선 개선안(실행 우선)

### P0 (즉시)

1. 인증 후 접근 제어 정책 통일
- 승인(`isApproved`)·차단(`isBanned`) 상태를 공통 가드로 강제
- 홈/포스트 작성 등 라우트별 편차 제거

2. 내부망 접근형 네트워크 호출 방어 보강
- `server-address/check`, `link-preview`에 DNS 재해석/redirect 재검증 추가

3. 인메모리 레이트리밋 운영 위험 완화
- Redis/Upstash 기반 분산 레이트리밋으로 이관 설계 착수

### P1 (1~2주)

4. 관리자 목록 API 페이지네이션 추가
- `GET /api/admin/users|posts|inquiries`에 `page`, `limit`, `cursor` 도입

5. 댓글 트리 조회 성능 개선
- 재귀 BFS 다중 쿼리 대신 CTE 또는 배치 전략으로 DB 왕복 감소

6. 좋아요 토글 원자성 확보
- `like` 레코드와 `post.likes` 업데이트를 트랜잭션/원자 연산으로 통합

### P2 (2~4주)

7. 대형 파일 분해 리팩토링
- `CommentSection`: 실시간/페이징/렌더 오케스트레이션 분리
- `link-preview/providers`: provider별 모듈 분리 + 공통 네트워크 가드 추출

8. Route 검증 표준화
- zod 스키마/에러 응답 계약을 공통 유틸로 통일

## 8. 핵심 경계(참조 포인트)

- API 경계: `src/app/api`
- 도메인 서비스 경계: `src/lib/services`
- 데이터 모델 경계: `prisma/schema.prisma`

