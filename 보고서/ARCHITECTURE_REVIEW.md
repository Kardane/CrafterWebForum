# CrafterWebForum 아키텍처 리뷰

## 0. 문서 메타
- 작성일: 2026-03-10
- 기준 커밋: `0a1c0ed`
- 검토 범위: `src/app`, `src/app/api`, `src/lib`, `src/components`, `src/__tests__`, `scripts`, `e2e`, `prisma/schema.prisma`, `next.config.ts`, `package.json`, `README.md`

## 1. 시스템 개요
현재 서비스는 Next.js App Router 기반 단일 저장소 커뮤니티 웹앱임.

- 포럼 피드/상세/댓글/알림/푸시/관리자 기능을 하나의 Next.js 프로젝트 안에서 운영
- Prisma를 공통 데이터 계층으로 사용하고 로컬 SQLite와 프로덕션 Turso(libsql)를 함께 지원
- 인증은 NextAuth Credentials 기반, 실사용자 권한 판단은 DB 재조회 중심
- 최근 운영 방향은 신규 기능 확대보다 stale schema 대응, 구독/알림 fallback, 배포 내구성 강화 쪽에 가까움

## 2. 기술 스택

### 2.1 런타임/프레임워크
- `next@16.1.6` (App Router)
- `react@19.2.0`
- `typescript@5`

### 2.2 데이터/인증
- `@prisma/client@6.19.2`
- `next-auth@5 beta` + Credentials Provider
- `bcryptjs` 비밀번호 검증
- SQLite(local) / Turso(libsql, production)

### 2.3 인프라 연동
- Vercel Blob 업로드
- Supabase Realtime 브로드캐스트
- Web Push + GitHub Actions scheduler 디스패치
- 외부 링크 프리뷰 공급자(GitHub, Modrinth, CurseForge, DCinside)

### 2.4 품질 도구
- ESLint
- Vitest (`src/__tests__` 중심)
- Playwright (`e2e/*.spec.ts`)

## 3. 구조 개요

```text
CrafterWebForum/
├── src/app/                 # App Router 페이지와 API 진입면
├── src/components/          # 기능별 UI 계층
├── src/lib/                 # 서비스/보안/캐시/preview/realtime/push 코어
├── src/__tests__/           # Vitest 단위/통합 테스트
├── scripts/                 # setup, migration, deploy-readiness, repair 스크립트
├── e2e/                     # Playwright 브라우저 시나리오
├── prisma/schema.prisma     # 데이터 모델 원본
└── 보고서/                  # 아키텍처 메모 및 과거 문서
```

## 4. 레이어 구조

### 4.1 라우팅 계층
- `src/app`: 페이지/레이아웃/서버 컴포넌트
- `src/app/api/**/route.ts`: 인증, 포스트, 댓글, 푸시, 링크 프리뷰, 관리자 API
- `src/proxy.ts`: `/post/*` 리다이렉트와 `/admin`, `/profile` 보호를 담당하는 edge 레이어

### 4.2 도메인/서비스 계층
- `src/lib/services/*`: 포스트 목록/상세/사이드바 추적 포스트 계산 같은 비즈니스 집계
- `src/lib/*`: 인증 보조, 세션 사용자 정규화, 레이트리밋, SSRF 방어, 업로드, 푸시, 캐시 태그, markdown/embeds 처리

### 4.3 UI 계층
- `src/components/comments/*`: 댓글 스트림, 트리, draft, pinned, read marker, realtime 반영을 묶은 고복잡도 영역
- `src/components/posts/*`: 피드/상세 카드, 구독 버튼, 본문 hydration
- `src/components/layout/*`: 메인 레이아웃, 사이드바, 도구 모음, 추적 포스트 패널
- `src/components/sidebar/*`: 사용자 링크 설정 모달과 DnD UI

### 4.4 데이터 계층
- `prisma/schema.prisma`: `User`, `Post`, `Comment`, `Like`, `PostRead`, `PostSubscription`, `Notification`, `PushSubscription`, `NotificationDelivery` 중심
- `src/lib/prisma.ts`: SQLite/Turso URL에 따라 Prisma adapter를 구성

## 5. 핵심 도메인 모델

| 도메인 | 설명 | 주요 관계 |
|---|---|---|
| `User` | 계정, 역할, 승인/밴 상태, Minecraft 연동 | posts, comments, likes, postReads, postSubscriptions, pushSubscriptions |
| `Post` | 게시글 본문, 태그, `commentCount`, soft delete 상태 | author, comments, likes, postReads, subscriptions |
| `Comment` | 루트/대댓글 트리, pin 상태 | post, parent/replies, author |
| `PostRead` | 사용자별 게시글 읽음 마커 | `(userId, postId)` 복합 키 |
| `PostSubscription` | 포스트 알림 구독 상태 | user, post |
| `Notification` | 앱 내부 알림 이벤트 | recipient, actor, deliveries |
| `PushSubscription` | 브라우저 push endpoint 등록 | user, deliveries |
| `NotificationDelivery` | 채널별 전송 상태 큐 | notification, push subscription |

## 6. 주요 라우트 도메인

### 6.1 공개/사용자 도메인
- `/`, `/posts/[id]`, `/posts/new`, `/posts/[id]/edit`
- `/profile`, `/notifications`, `/pending`
- `/login`, `/register`, `/forgot-password`, `/auth/error`

### 6.2 관리자 도메인
- `/admin`, `/admin/users`, `/admin/posts`, `/admin/inquiries`, `/admin/backup`
- 대응 API는 `src/app/api/admin/**`
- 관리자 전용 layout이 따로 존재해 공개 흐름과 경계가 명확함

### 6.3 인프라/부가 도메인
- `/api/push/**`, `/api/jobs/push-dispatch`, `/api/realtime/**`
- `/api/link-preview`, `/api/upload`, `/api/sidebar/tracked-posts`
- `/api/server-address/check`, `/api/minecraft/**`

## 7. 대표 요청 플로우

### 7.1 인증/권한
- 로그인 처리: `src/auth.ts`
- 페이지/API 실사용자 해석: `src/lib/active-user.ts` (`resolveActiveUserFromSession`)
- 관리자 API 게이트: `src/lib/admin-auth.ts` (`requireAdmin`)
- 특징: 세션 유무만 보지 않고 승인, 밴, soft delete 상태를 DB 기준으로 다시 검증함

### 7.2 게시글 목록 조회
- 페이지 진입: `src/app/page.tsx`
- API: `src/app/api/posts/route.ts`
- 서비스: `src/lib/services/posts-service.ts`
- 특징: 목록 캐시, 검색/태그/정렬, 세션 사용자별 like/subscription overlay를 한 번에 조합

### 7.3 게시글 상세 + 읽음 마커 동기화
- 페이지: `src/app/posts/[id]/page.tsx`
- 서비스: `src/lib/services/post-detail-service.ts`
- 특징: 상세 데이터, 초기 댓글 트리, 좋아요/구독 상태, 읽음 마커 업데이트를 함께 다룸

### 7.4 댓글 작성/수정/삭제
- 라우트: `src/app/api/posts/[id]/comments/route.ts`, `src/app/api/comments/[id]/route.ts`
- 특징: 댓글 생성/수정/삭제와 `commentCount`, `updatedAt`, realtime event, 알림 후처리가 연결됨
- 최근 보강점: `NotificationDelivery`/`PostSubscription` 스키마 미준비 시에도 핵심 댓글 작성 경로는 유지하고 알림 후처리만 스킵

### 7.5 포스트 구독/사이드바 추적 목록
- 라우트: `src/app/api/posts/[id]/subscription/route.ts`, `src/app/api/sidebar/tracked-posts/route.ts`
- 서비스/UI: `src/lib/services/sidebar-tracked-posts-service.ts`, `src/components/layout/SidebarTrackedPosts.tsx`, `src/components/posts/PostSubscriptionButton.tsx`
- 특징: 현재 정책은 "구독 중인 포스트만 사이드바 표시"이며, soft-deleted post는 제외
- fallback 전략: `PostSubscription` 테이블이 없으면 API는 `fallbackLocalOnly`로 응답하고 클라이언트 local fallback으로 UX를 유지

### 7.6 링크 프리뷰/임베드
- 라우트: `src/app/api/link-preview/route.ts`
- 공급자: `src/lib/link-preview/providers.ts`, `providers-github.ts`
- 렌더: `src/components/posts/PostContent.tsx`, `src/lib/embeds/**`
- 특징: SSRF 방어, provider 캐시, post meta hydration, 외부 카드 fallback이 결합됨

### 7.7 푸시 알림 전달
- 구독 API: `src/app/api/push/subscribe/route.ts`, `unsubscribe/route.ts`
- 디스패치 API: `src/app/api/jobs/push-dispatch/route.ts`
- 스케줄러: `.github/workflows/push-dispatch.yml`
- 특징: 브라우저가 닫혀 있어도 전달하기 위해 Web Push + scheduler 기반 outbox dispatch 채택

## 8. 현재 아키텍처 강점

1. 인증/인가 공통화가 잘 되어 있음
   - 대부분의 API가 세션 확인 이후 DB 기반 활성 사용자 해석을 거침

2. 외부 입력 방어층이 명확함
   - `readJsonBody`, `zod`, `network-guard`, 업로드 화이트리스트가 각 경로에 자리 잡음

3. 서비스 계층 분리가 꽤 실용적임
   - 피드/상세/사이드바처럼 join이 많은 영역을 `src/lib/services`로 모아 page/route 복잡도를 낮춤

4. 운영 장애를 흡수하는 fallback가 이미 설계됨
   - stale schema 상황에서도 feed/detail/comment 핵심 경로를 살리고 구독/알림 부가 경로만 degrade 가능

5. 테스트 경계가 비교적 또렷함
   - `src/__tests__/api`, `components`, `lib`로 분리되어 회귀 포인트를 찾기 쉬움

## 9. 리스크/기술부채

### 9.1 운영 스키마 불일치 리스크
- `PostSubscription`, `NotificationDelivery`, `PushSubscription` 같은 운영성 테이블이 배포 순서에 민감함
- 현재는 fallback로 완화하지만, 장기적으로는 스키마 적용 보장 절차가 더 중요함

### 9.2 메모리 기반 보조 상태
- 레이트리밋은 Upstash 미구성 시 메모리 폴백 사용
- 일부 fallback/local queue 성격 상태도 인스턴스 재시작 시 유지되지 않음

### 9.3 대형 UI 컴포넌트 집중
- `CommentForm.tsx`, `CommentSection.tsx`, `CommentItem.tsx`, `SidebarTrackedPosts.tsx`는 각각 500~800줄대
- 실시간, 스크롤, 업로드, draft, fallback가 얽혀 있어 변경 비용이 큼

### 9.4 경계 계층 불일치
- `src/proxy.ts`는 세션 토큰 기준, API는 DB 기준 재검증을 수행
- 보안상 치명적이진 않지만 정책 중복과 예외 처리 차이의 원인이 될 수 있음

### 9.5 문서/구현 간 일부 괴리 가능성
- README에는 제거된 신문고 기능 기록이 남아 있고, 코드베이스에는 관련 잔존 디렉터리도 일부 존재함
- 기능 제거/호환 레이어 종료 시점 문서화가 더 필요함

## 10. 권장 개선 로드맵

### P0 (즉시)
- 배포 전 `check-deploy-readiness --with-db`를 실제 릴리즈 게이트로 강제
- push/subscription 관련 테이블 적용 누락을 감지하는 운영 runbook 정리

### P1 (단기)
- 댓글 UI 대형 파일을 hook/helper 단위로 더 분해
- `src/proxy.ts`와 API 권한 판단 기준을 문서 또는 코드로 더 명시적으로 맞춤
- fallbackLocalOnly 같은 운영 fallback의 지속성 정책(새로고침/다중 디바이스)을 명확히 정의

### P2 (중기)
- 업로드 후처리, push dispatch 일부를 더 durable한 external worker/queue로 이관 검토
- 링크 프리뷰 provider를 더 독립적인 adapter 계층으로 분리해 테스트 비용 절감
- 주요 API p95/p99, 에러율, 배포 스키마 준비 상태를 대시보드화

## 11. 총평
현재 구조는 기능 면에서 이미 포럼 이상의 운영 복잡도를 가진 단일 저장소 서비스임.

- 장점은 보안/검증/서비스 계층/운영 fallback가 실제 문제를 꽤 잘 흡수한다는 점
- 약점은 운영 스키마 준비도와 대형 UI 컴포넌트 집중이 계속 누적된다는 점
- 당분간 최우선 과제는 새로운 화면 추가보다 배포 일관성, fallback 정책 명문화, 댓글/구독 주변 복잡도 분산이라고 보는 게 맞음
