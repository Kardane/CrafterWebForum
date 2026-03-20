# CrafterWebForum Handsoff

## 0. 문서 메타
- 작성일: 2026-03-20
- 기준 브랜치: `master`
- 기준 최신 원격 커밋: `f913f74`
- 목적: 최근 세션에서 진행한 수정, 검증, 운영 주의점을 다음 작업자에게 인계하기 위한 문서

## 1. 최근 반영 범위 요약
최근 세션에서 집중적으로 다룬 범위는 아래 네 축임.

1. 댓글 UX/안정화
- 최신 댓글 이동 시 아래로 갔다가 다시 위로 튀는 스크롤 복원 충돌 수정
- 댓글 hover 툴바 상태 정리, 즉시 닫힘 복구, 수정 버튼 진입 동선 보정
- 댓글 수정 API의 구형 스키마 의존성 제거 및 부가 후처리 실패가 본 요청을 500으로 만들지 않도록 보정

2. 포스트 구독/사이드바
- 사이드바를 구독 포스트 기준으로 정리
- 새 댓글 unread 하이라이트 유지 규칙 추가
- fallback local 구독 목록이 refresh/새로고침 시 사라지지 않도록 회귀 수정
- 사이드바 이중 스크롤 제거

3. 투표 기능
- 투표 옵션 입력 key 안정화
- 투표 생성 시 raw text를 textarea에 남기지 않고 즉시 댓글 전송하도록 수정
- `POST /api/comments/[id]/vote` 추가 및 댓글 카드에서 실제 투표 mutation 연결

4. 알림/푸시/E2E
- 알림 체인 테스트 보강: notifications route, read route, `useNotifications`, Playwright E2E
- 푸시 payload를 `멘션 알림 · <글 제목>`, `새 댓글 · <글 제목>` 형태로 개선
- 브라우저 종료 상태 푸시 운영 문서 2종 추가
- 로컬 E2E 검증을 위해 Playwright 브라우저 라이브러리 및 테스트 데이터 점검 수행

## 2. 최근 주요 커밋 맥락
- `8c21957` `fix: 투표 생성과 제출 경로 보정`
- `318e9f6` `fix: 사이드바 구독 unread 상태 보정`
- `fbbba08` `fix: fallback 구독 목록 refresh 회귀 수정`
- `f913f74` `add: 푸시 알림 운영 문서와 payload 개선`

그 이전에는 댓글 수정/툴바/스크롤 관련 수정이 연속으로 들어감.

## 3. 현재 구조에서 특히 주의할 영역

### 3.1 댓글 영역 핫스팟
대형 파일이 여전히 남아 있음.
- `src/components/comments/CommentForm.tsx` 816줄
- `src/components/comments/CommentSection.tsx` 789줄
- `src/components/comments/CommentItem.tsx` 692줄

댓글 입력, draft, 업로드, poll, hover 툴바, scroll restoration, realtime가 한 영역에 몰려 있음. 수정 시 회귀 범위가 넓음.

### 3.2 사이드바 구독 상태
- `src/components/layout/SidebarTrackedPosts.tsx` 556줄
- `src/lib/services/sidebar-tracked-posts-service.ts` 311줄

현재 상태는 `server base + fallback local + realtime optimistic unread` 3계층 병합 구조임. 단순해 보이지만 refresh 시점이 꼬이면 바로 회귀남.

### 3.3 알림/푸시
- `src/components/notifications/useNotifications.ts` 167줄
- `src/app/api/jobs/push-dispatch/route.ts`
- `.github/workflows/push-dispatch.yml`
- `public/sw.js`

인앱 unread, 브라우저 Notification, Web Push, GitHub Actions scheduler가 분리돼 있음. 한 경로만 보면 전체 동작을 오판하기 쉬움.

## 4. 이번 세션 기준 검증 상태

### 4.1 자동 테스트
통과 확인한 대표 테스트군
- 멘션/알림 단위·통합: `mentions.test.ts`, `post-comments.route.test.ts`, `notifications.route.test.ts`, `useNotifications.test.tsx`, `jobs.push-dispatch.route.test.ts`
- 사이드바 unread/fallback: `SidebarTrackedPosts.test.tsx`, `sidebar-tracked-posts-state.test.ts`, `sidebar-tracked-posts-service.test.ts`
- 댓글 이동/툴바/수정: `useCommentScroll.test.tsx`, `CommentItem.edit.test.tsx`, `comments.route.test.ts`
- 투표: `PollModal.test.tsx`, `CommentForm.test.tsx`, `comment-vote.route.test.ts`

### 4.2 Playwright E2E
- 파일: `e2e/notifications.spec.ts`
- 최종 상태: 2개 시나리오 통과
  - 멘션 알림 흐름
  - 포스트 구독 댓글 알림 + push dispatch 흐름

주의
- 이 E2E는 기본 상태 그대로는 바로 안 돌 수 있음
- 원인:
  1. WSL에 Chromium 런타임 라이브러리 부족 가능
  2. `.env.local`에 적은 E2E 계정/포스트가 로컬 DB에 없을 수 있음
  3. Codex 샌드박스 안에서는 Chromium가 `sandbox_host_linux.cc`로 죽을 수 있음

실제 이번 검증에서도 샌드박스 밖 실행으로 최종 통과함.

## 5. 로컬 환경에서 확인된 사실

### 5.1 로컬 DB 스키마 불일치 가능성
현재 로컬 SQLite는 Prisma 최신 스키마와 완전히 일치하지 않을 수 있음.
대표 사례
- `Post.board` 컬럼이 실제 DB엔 없음
- 앱 코드는 `db-schema-guard`와 tag metadata fallback로 일부 경로를 흡수함

이 의미는 명확함.
- 테스트가 다 통과해도 로컬 DB 직접 조회/시드 작성은 raw SQL이나 guard를 염두에 둬야 함
- Prisma model select를 그대로 믿고 로컬 DB를 다루면 `P2022`가 날 수 있음

### 5.2 현재 워킹트리 상태
이번 문서 작성 시점 기준으로 아래 변경은 이미 워킹트리에 있었고, 관련 작업에서 건드리지 않았음.
- `package.json`
- `package-lock.json`
- `src/app/layout.tsx`
- `dev.db` (untracked)

다음 작업자는 이 파일들을 이번 세션 산출물과 섞어서 커밋하면 안 됨.

## 6. 운영상 주의점
1. GitHub Actions는 푸시 디스패치 스케줄러로만 사용 중
- `.github/workflows/push-dispatch.yml`
- 5분 주기

2. Supabase는 DB가 아니라 realtime event bus 용도
- 댓글/알림 unread/UI 동기화 담당
- 제거하면 저장은 남아도 실시간 UX가 무너짐

3. 브라우저 종료 알림은 이미 구조상 지원
- Service Worker + PushSubscription + NotificationDelivery + scheduler
- 다만 실제 전달은 브라우저 정책, OS 알림 권한, scheduler 상태에 의존

## 7. 다음 작업자가 먼저 확인할 것
1. `npm run doctor`
2. `.env.local`의 `DATABASE_URL`, `CRON_SECRET`, VAPID 키 확인
3. push 관련이면 `보고서/PUSH_NOTIFICATION_OPERATION_CHECKLIST.md` 먼저 확인
4. 브라우저 종료 푸시 재현이면 `보고서/BROWSER_CLOSED_PUSH_TEST_SCENARIO.md` 먼저 확인
5. 사이드바/댓글 변경 전에는 관련 테스트부터 먼저 돌릴 것

## 8. 권장 다음 액션
1. 댓글 영역(`CommentForm`, `CommentSection`, `CommentItem`)을 기능 단위 hook/helper로 더 쪼개기
2. 사이드바 unread 병합 규칙을 UI 밖 순수 함수 계층으로 더 밀어내기
3. E2E용 로컬 시드 스크립트를 공식화해서 `.env.local`과 DB mismatch를 줄이기
4. 로컬 SQLite와 Prisma 스키마 차이를 줄이거나, 레거시 스키마 대응 가이드를 README에 더 명시하기

## 9. 참고 문서
- `보고서/ARCHITECTURE_REVIEW.md`
- `보고서/PUSH_NOTIFICATION_OPERATION_CHECKLIST.md`
- `보고서/BROWSER_CLOSED_PUSH_TEST_SCENARIO.md`
