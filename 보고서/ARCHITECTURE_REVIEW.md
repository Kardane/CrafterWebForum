# CrafterWebForum 아키텍처 리뷰

## 0. 문서 메타
- 작성일: 2026-03-20
- 기준 커밋: `f913f74`
- 검토 범위: `src/app`, `src/app/api`, `src/lib`, `src/components`, `src/__tests__`, `scripts`, `e2e`, `prisma/schema.prisma`, `README.md`, `.github/workflows/push-dispatch.yml`
- 참고 수치
  - API route 파일 수: 41
  - Vitest 테스트 파일 수: 69
  - Playwright E2E 스펙 수: 4

## 1. 시스템 개요
현재 서비스는 Next.js App Router 기반 단일 저장소 커뮤니티 웹앱임.

- 포럼 피드/상세/댓글/알림/푸시/관리자 기능을 하나의 Next.js 프로젝트 안에서 운영
- Prisma를 공통 데이터 계층으로 사용하고 로컬 SQLite와 프로덕션 Turso(libsql)를 함께 지원
- 인증은 NextAuth Credentials 기반, 실사용자 권한 판단은 DB 재조회 중심
- 실시간 동기화는 Supabase Realtime, 브라우저 종료 푸시는 Web Push + GitHub Actions scheduler 기반
- 최근 변경 방향은 신규 화면 확장보다 stale schema 대응, 구독 fallback, 댓글/사이드바 회귀 방지, E2E 보강 쪽에 가까움

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
- Supabase Realtime 브로드캐스트
- Web Push + Service Worker + GitHub Actions scheduler
- Vercel Blob 업로드
- 외부 링크 프리뷰 공급자(GitHub, Modrinth, CurseForge, DCinside)

### 2.4 품질 도구
- ESLint
- Vitest (`src/__tests__`)
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
├── public/sw.js             # 브라우저 종료 푸시 수신 서비스워커
└── 보고서/                  # 운영 문서 및 리뷰 문서
```

## 4. 레이어 구조

### 4.1 라우팅 계층
- `src/app`: 페이지/레이아웃/서버 컴포넌트
- `src/app/api/**/route.ts`: 인증, 포스트, 댓글, 투표, 푸시, 링크 프리뷰, 관리자 API
- `src/proxy.ts`: `/admin`, `/profile` 보호와 일부 리다이렉트 처리

### 4.2 도메인/서비스 계층
- `src/lib/services/*`: 포스트 목록/상세/사이드바 추적 포스트 계산 같은 비즈니스 집계
- `src/lib/*`: 인증 보조, 세션 사용자 정규화, 레이트리밋, SSRF 방어, 업로드, 푸시, 캐시 태그, markdown/embeds 처리
- 최근 추가 포인트: poll 직렬화/투표 로직(`src/lib/poll.ts`), stale schema guard(`src/lib/db-schema-guard.ts`) 활용 확대

### 4.3 UI 계층
- `src/components/comments/*`: 댓글 스트림, 트리, draft, pinned, read marker, poll, realtime 반영을 묶은 고복잡도 영역
- `src/components/posts/*`: 피드/상세 카드, 구독 버튼, 본문 hydration
- `src/components/layout/*`: 메인 레이아웃, 사이드바, 도구 모음, 추적 포스트 패널
- `src/components/notifications/*`: unread count, 브라우저 Notification, push subscribe bootstrap
- `src/components/poll/*`: PollModal, PollCard

### 4.4 데이터 계층
- `prisma/schema.prisma`: `User`, `Post`, `Comment`, `Like`, `PostRead`, `PostSubscription`, `Notification`, `PushSubscription`, `NotificationDelivery` 중심
- 주의: 실제 로컬 SQLite는 최신 Prisma 스키마와 일부 불일치할 수 있고, 코드가 guard/fallback로 이를 흡수함

## 5. 핵심 도메인 모델

| 도메인 | 설명 | 주요 관계 |
|---|---|---|
| `User` | 계정, 역할, 승인/밴 상태, Minecraft 연동 | posts, comments, likes, postReads, postSubscriptions, pushSubscriptions |
| `Post` | 게시글 본문, 태그, `commentCount`, soft delete 상태 | author, comments, likes, postReads, subscriptions |
| `Comment` | 루트/대댓글 트리, pin 상태, poll raw content 저장 위치 | post, parent/replies, author |
| `PostRead` | 사용자별 게시글 읽음 마커 | `(userId, postId)` 복합 키 |
| `PostSubscription` | 포스트 알림 구독 상태 | user, post |
| `Notification` | 앱 내부 알림 이벤트 | recipient, actor, deliveries |
| `PushSubscription` | 브라우저 push endpoint 등록 | user, deliveries |
| `NotificationDelivery` | 채널별 전송 상태 큐 | notification, push subscription |

## 6. 대표 요청 플로우

### 6.1 인증/권한
- 로그인 처리: `src/auth.ts`
- 페이지/API 실사용자 해석: `src/lib/active-user.ts`
- 관리자 API 게이트: `src/lib/admin-auth.ts`
- 특징: 세션 유무만 보지 않고 승인, 밴, soft delete 상태를 DB 기준으로 다시 검증함

### 6.2 게시글 목록 조회
- 페이지: `src/app/page.tsx`
- API: `src/app/api/posts/route.ts`
- 서비스: `src/lib/services/posts-service.ts`
- 특징: 검색/태그/정렬 + 세션 사용자별 like/subscription overlay 조합

### 6.3 게시글 상세 + 읽음 마커 동기화
- 페이지: `src/app/posts/[id]/page.tsx`
- 서비스: `src/lib/services/post-detail-service.ts`
- 특징: 상세 데이터, 초기 댓글 트리, 좋아요/구독 상태, 읽음 마커 업데이트를 함께 다룸

### 6.4 댓글 작성/수정/삭제
- 라우트: `src/app/api/posts/[id]/comments/route.ts`, `src/app/api/comments/[id]/route.ts`
- 특징: 댓글 생성/수정/삭제와 `commentCount`, `updatedAt`, realtime event, 알림 후처리가 연결됨
- 최근 보강점
  - 구형 스키마에서도 수정 API가 500으로 무너지지 않게 후처리 의존성 축소
  - 부가 작업 실패가 본 요청 실패로 전염되지 않도록 best-effort 처리

### 6.5 포스트 구독/사이드바 추적 목록
- 라우트: `src/app/api/posts/[id]/subscription/route.ts`, `src/app/api/sidebar/tracked-posts/route.ts`
- 서비스/UI: `src/lib/services/sidebar-tracked-posts-service.ts`, `src/components/layout/SidebarTrackedPosts.tsx`, `src/components/posts/PostSubscriptionButton.tsx`
- 현재 정책: 사이드바에는 구독 중인 포스트만 표시
- 특징
  - `PostSubscription` 테이블이 없으면 `fallbackLocalOnly`로 degrade
  - 클라이언트는 `server base + fallback local + realtime optimistic unread` 병합으로 UX를 유지
  - `POST_READ_MARKER_UPDATED` 이벤트가 하이라이트 해제 기준으로 사용됨

### 6.6 투표 생성/투표 참여
- 모달/UI: `src/components/poll/PollModal.tsx`, `src/components/poll/PollCard.tsx`
- 댓글 입력: `src/components/comments/CommentForm.tsx`
- 투표 API: `src/app/api/comments/[id]/vote/route.ts`
- 코어 로직: `src/lib/poll.ts`
- 특징: 별도 테이블 없이 댓글 content 안 `[POLL_JSON]...[/POLL_JSON]`를 갱신하는 경량 구조

### 6.7 링크 프리뷰/임베드
- 라우트: `src/app/api/link-preview/route.ts`
- 공급자: `src/lib/link-preview/providers.ts`, `providers-github.ts`
- 렌더: `src/components/posts/PostContent.tsx`, `src/lib/embeds/**`
- 특징: SSRF 방어, provider 캐시, hydration, GitHub 카드 메타 갱신, Streamable/YouTube 임베드 렌더를 포함

### 6.8 푸시 알림 전달
- 구독 API: `src/app/api/push/subscribe/route.ts`, `unsubscribe/route.ts`
- 디스패치 API: `src/app/api/jobs/push-dispatch/route.ts`
- 클라이언트 bootstrap: `src/components/notifications/useNotifications.ts`, `src/components/profile/PushSubscriptionPanel.tsx`
- 스케줄러: `.github/workflows/push-dispatch.yml`
- 특징
  - `Notification`과 `NotificationDelivery`를 분리한 outbox 구조
  - 브라우저 종료 상태 대응을 위해 Web Push 사용
  - 최근 푸시 payload는 `멘션 알림 · <글 제목>`, `새 댓글 · <글 제목>` 식으로 구체화됨

## 7. 현재 아키텍처 강점

1. 인증/인가 공통화가 잘 되어 있음
- 대부분의 API가 세션 확인 이후 DB 기반 활성 사용자 해석을 거침

2. 외부 입력 방어층이 명확함
- `readJsonBody`, `zod`, `network-guard`, 업로드 화이트리스트가 각 경로에 자리 잡음

3. 장애 흡수용 fallback가 실제 운영 문제를 고려함
- stale schema 상황에서도 feed/detail/comment 핵심 경로를 살리고 구독/알림 부가 경로만 degrade 가능

4. 알림 체인이 저장/실시간/푸시로 분리돼 있음
- 푸시 디스패치 실패가 앱 내부 알림 저장 자체를 망치지 않음

5. 테스트 레이어가 비교적 명확함
- API, components, lib, e2e가 분리되어 회귀 지점을 특정하기 쉬움

## 8. 리스크/기술부채

### 8.1 운영 스키마 불일치 리스크
- 코드가 guard를 많이 가졌다는 건 반대로 배포/로컬 DB와 Prisma 스키마가 자주 어긋난다는 뜻이기도 함
- 실제 로컬 검증 중에도 `Post.board` 컬럼 부재가 확인됨

### 8.2 대형 UI 컴포넌트 집중
- `CommentForm.tsx` 816줄
- `CommentSection.tsx` 789줄
- `CommentItem.tsx` 692줄
- `SidebarTrackedPosts.tsx` 556줄
- `link-preview/providers.ts` 395줄

핵심 상호작용이 몇 개 파일에 몰려 있어 작은 수정도 회귀 범위가 넓음.

### 8.3 클라이언트 보조 상태 복잡도
- 사이드바 구독 목록은 fallback local, realtime optimistic unread, server refresh reconcile이 함께 존재
- 설계 의도는 맞지만 디버깅 난이도가 높음

### 8.4 실시간 버스 외부 의존
- Supabase Realtime이 댓글/알림 UX를 실질적으로 떠받침
- 제거 시 저장 계층은 남아도 실시간 경험이 무너짐

### 8.5 E2E 재현성 비용
- Playwright는 브라우저 라이브러리, env, 테스트 계정/포스트 데이터, 샌드박스 제약을 모두 맞춰야 함
- 현재 E2E 자체는 유효하지만 재현 환경 문서화가 더 중요함

## 9. 최근 변경이 아키텍처에 준 영향

### 9.1 댓글 수정 경로 안정화
- 본 변경으로 `PATCH /api/comments/[id]`는 부가 후처리 실패에 덜 민감해졌음
- 장점: 사용자 요청 실패율 감소
- 단점: 후처리 실패를 운영 로그/모니터링으로 더 잘 잡아야 함

### 9.2 투표 기능 경량 확장
- 별도 테이블 없이 댓글 content 기반으로 처리해서 구현은 빠름
- 장점: 마이그레이션 비용 없음
- 단점: poll이 커질수록 comment content mutation에 과도하게 의존

### 9.3 사이드바 unread 유지 규칙 도입
- 즉시성은 개선됐음
- 대신 server authoritative model 하나로만 설명되지 않고 optimistic merge 규칙을 알아야 함

### 9.4 푸시 운영성 향상
- payload 품질과 운영 체크리스트는 좋아졌음
- 하지만 scheduler는 여전히 GitHub Actions에 묶여 있고, 5분 지연 특성은 유지됨

## 10. 권장 개선 로드맵

### P0
- 로컬/배포 DB 스키마 준비 상태를 더 강하게 게이트화
- E2E용 로컬 시드 스크립트 공식화
- 댓글 수정/투표/구독 흐름의 운영 에러 로그를 구조적으로 수집

### P1
- 댓글 UI 대형 파일을 hook/helper 단위로 추가 분리
- `SidebarTrackedPosts`의 optimistic unread 병합을 순수 함수 계층으로 더 이동
- 푸시 scheduler를 GitHub Actions 유지 또는 Vercel Cron 이관 중 하나로 명확히 결정

### P2
- poll 저장 구조를 comment content mutation에서 분리할지 재평가
- 링크 프리뷰 provider adapter 계층을 더 분리해 테스트 단위를 줄이기
- 실시간 이벤트와 unread 계산의 상태 전이 다이어그램 문서화

## 11. 총평
현재 구조는 단순 포럼을 넘어 실시간 댓글, 구독, 알림, 웹푸시, 관리자 기능을 가진 운영형 단일 저장소 서비스임.

- 강점은 보안/검증/fallback가 실제 운영 문제를 많이 흡수한다는 점
- 약점은 stale schema 대응과 대형 UI 파일 집중으로 인해 구조 복잡도가 빠르게 쌓인다는 점
- 당분간 최우선은 새 기능 추가보다 댓글/사이드바/알림 주변의 상태 복잡도를 더 분리하고, 로컬/배포 DB 정합성과 E2E 재현성을 끌어올리는 것이라고 보는 게 맞음
