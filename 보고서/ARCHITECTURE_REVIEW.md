# CrafterWebForum 아키텍처 리뷰

## 0. 문서 메타
- 작성일: 2026-03-05
- 기준 커밋: `9a6daf0`
- 검토 범위: `src/app`, `src/app/api`, `src/lib`, `src/components`, `prisma/schema.prisma`, `next.config.ts`, `package.json`

## 1. 시스템 개요
현재 서비스는 Next.js App Router 기반 단일 저장소 구조의 커뮤니티 웹앱임.

- 프론트엔드 렌더링 + API Route + 인증 + 파일 업로드 + 푸시 디스패치를 한 프로젝트에서 운영하는 형태
- 기본 게시판(포럼) 중심 구조로 단순화되어 있고, 댓글/멘션/알림/푸시까지 연결된 트랜잭션 플로우 보유
- 데이터 계층은 Prisma를 통해 SQLite/Turso를 공통 추상화

## 2. 기술 스택

### 2.1 런타임/프레임워크
- `next@16.1.6` (App Router)
- `react@19.2.3`
- `typescript@5`

### 2.2 데이터/인증
- `@prisma/client@6.19.2`
- `next-auth@5 beta` + Credentials Provider
- `bcryptjs` 비밀번호 검증

### 2.3 인프라 연동
- Vercel Blob (`@vercel/blob`) 업로드
- Supabase Realtime 브로드캐스트 (`src/lib/realtime/server-broadcast.ts`)
- Web Push (`web-push`) + 디스패치 API

### 2.4 품질 도구
- ESLint
- Vitest (현재 통합 실행 기준 48 files / 199 tests)
- Playwright 설정 존재

## 3. 레이어 구조

### 3.1 라우팅 계층
- `src/app`: 페이지/레이아웃
- `src/app/api/**/route.ts`: API 엔드포인트 (현재 38개)

### 3.2 도메인/서비스 계층
- `src/lib/services/*`: 게시글 리스트/상세 조회 같은 비즈니스 쿼리 조합
- `src/lib/*`: 인증, 레이트리밋, 네트워크 가드, 업로드, 마크다운/임베드 처리, 캐시 태그 등 공통 모듈

### 3.3 UI 계층
- `src/components/*`: 레이아웃, 게시글, 댓글, 인증, 관리자 탭 단위 컴포넌트
- `src/components/ui/ImageLightboxProvider.tsx`: 전역 라이트박스 컨텍스트 제공

### 3.4 데이터 계층
- `prisma/schema.prisma`: User/Post/Comment/Like/PostRead/Notification/PushSubscription/NotificationDelivery 중심
- `src/lib/prisma.ts`: SQLite/Turso URL에 따라 Prisma Adapter 분기

## 4. 핵심 도메인 모델

| 도메인 | 설명 | 주요 관계 |
|---|---|---|
| User | 계정/권한/승인 상태 | posts, comments, likes, pushSubscriptions |
| Post | 게시글 본문/태그/카운트 | author, comments, likes, postReads |
| Comment | 댓글/대댓글 트리 | post, parent/replies, author |
| PostRead | 게시글별 읽음 마커 | (userId, postId) 복합 키 |
| Notification | 앱 알림 이벤트 | recipient(user), actor(user), deliveries |
| NotificationDelivery | 채널별 전송 상태 큐 | notification, subscription |
| PushSubscription | 브라우저 구독 | user, deliveries |

## 5. 대표 요청 플로우

### 5.1 인증/권한
- 로그인 처리: `src/auth.ts`
- API 실사용자 검증: `src/lib/active-user.ts` (`resolveActiveUserFromSession`)
- 관리자 API 게이트: `src/lib/admin-auth.ts` (`requireAdmin`)

### 5.2 게시글 조회
- 라우트: `src/app/api/posts/route.ts`
- 서비스: `src/lib/services/posts-service.ts`
- 특징: `unstable_cache`, 서버 타이밍 헤더, 페이지 기반 합리적 total 계산

### 5.3 댓글 작성
- 라우트: `src/app/api/posts/[id]/comments/route.ts`
- 특징: 트랜잭션으로 댓글 생성 + 게시글 commentCount 증가 + 읽음 마커 갱신 + 멘션 알림 큐잉

### 5.4 파일 업로드
- 라우트: `src/app/api/upload/route.ts`
- 이미지: 최적화 후 원본 업로드
- 썸네일: `src/lib/upload-postprocess-queue.ts` 비동기 큐 처리

### 5.5 링크 프리뷰
- 라우트: `src/app/api/link-preview/route.ts`
- 공급자: `src/lib/link-preview/providers.ts`, `providers-github.ts`
- 특징: SSRF 방어 + 캐시 + 리다이렉트 hop 제한

## 6. 현재 아키텍처 강점

1. 인증/인가 검증의 공통화
   - 대부분 API에서 `resolveActiveUserFromSession` 경유
2. 입력 파싱 일관성
   - `readJsonBody` + `zod` 스키마 조합으로 검증 패턴 통일
3. 외부 네트워크 안전장치
   - `network-guard` 기반 호스트/IP 차단 및 URL 안전성 검증
4. 관측성 개선
   - 주요 API에 `Server-Timing` 헤더 반영
5. 캐시 전략의 분리
   - 리스트/상세 조회 캐시와 뮤테이션 revalidate 태그 분리

## 7. 리스크/기술부채

### 7.1 내구성 리스크
- 업로드 썸네일 큐가 in-memory(`upload-postprocess-queue`)라서 재시작 시 유실 가능성 존재

### 7.2 분산 일관성 리스크
- 레이트리밋은 Upstash 미구성 시 메모리 폴백 사용
- 멀티 인스턴스 환경에서는 전역 한도 보장이 약해질 수 있음

### 7.3 경계 계층 불일치
- `src/proxy.ts`는 세션 토큰 기준 보호, API는 DB 기준 재검증
- 보안상 치명적이진 않지만 정책 일관성 측면에서 중복/불일치 포인트

### 7.4 유지보수성 이슈
- 일부 컴포넌트(`CommentForm`)에 대형 inline style 블록 존재
- 재사용/테마 변경 시 변경 비용 증가

## 8. 권장 개선 로드맵

### P0 (즉시)
- 썸네일 후처리를 외부 durable queue로 전환
- 프로덕션에서 분산 레이트리밋 필수화(폴백 fail-open 최소화)

### P1 (단기)
- Proxy 계층도 DB 상태 기반 재검증 전략으로 통일
- 공통 보안 헤더(CSP, HSTS, Referrer-Policy) 정책 명시 추가

### P2 (중기)
- 댓글 입력/렌더 UI의 스타일 분리(스타일 모듈화)
- 주요 API SLO 지표(95p/99p, 에러율) 대시보드화

## 9. 총평
현재 구조는 단일 저장소 서비스로서 실용적인 균형을 잘 잡은 상태임.

- 보안·검증·캐시·관측성 축이 이미 어느 정도 표준화됨
- 다만 in-memory 큐/폴백 기반 구성은 트래픽 증가 시 운영 리스크로 전환 가능성 높음
- 다음 단계는 "기능 추가"보다 "내구성과 운영 일관성" 강화가 우선순위임
