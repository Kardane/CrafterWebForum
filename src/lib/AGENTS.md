# lib 레이어 가이드

## 개요

`src/lib`는 DB 접근, 권한 판정, 보안 가드, 링크 프리뷰, 푸시, 실시간, 서비스 계층을 담는 코어 영역.
이 디렉터리 수정은 보통 여러 API/컴포넌트에 동시에 영향 줌.

## 어디부터 볼지

| 작업 | 위치 | 메모 |
|------|------|------|
| 피드/상세 계산 | `services/posts-service.ts`, `services/post-detail-service.ts` | 캐시와 overlay 집계 포함 |
| 사이드바 추적 포스트 | `services/sidebar-tracked-posts-service.ts` | 구독 기준 목록 계산 |
| DB 연결/스키마 예외 | `prisma.ts`, `db-schema-guard.ts` | Turso/LibSQL, missing table fallback |
| 인증/권한 | `active-user.ts`, `admin-auth.ts`, `session-user.ts` | user 상태 정규화 |
| 링크 프리뷰 | `link-preview/`, `embeds/` | 외부 서비스 파싱과 카드 렌더 소스 |
| 실시간/푸시 | `realtime/`, `push.ts` | 브로드캐스트/스케줄러/브라우저 알림 |
| 보안 | `network-guard.ts`, `rate-limit.ts`, `http-body.ts`, `env.ts` | 외부 입력 방어층 |

## 컨벤션

- 외부 네트워크 접근 전 `network-guard` 계열 검증 우선.
- 환경 변수는 `env.ts`나 관련 헬퍼에서 검증하고, 호출부에서 문자열 비교 남발하지 말 것.
- 서비스 계층은 UI shape를 직접 반환하는 편이라, 필드명 변경 시 클라이언트 영향도 같이 볼 것.
- PostSubscription/NotificationDelivery 같은 운영 스키마 차이는 fallback 분기 유지가 중요.
- 캐시 함수(`unstable_cache`, in-memory caches) 건드릴 때 test + build 둘 다 확인 필요.

## 이 디렉터리 안티패턴

- Prisma 예외를 무조건 500으로 올려버리는 패턴 금지. schema fallback 후보 먼저 확인.
- preview/push/network 코드에서 사설망 차단 우회 금지.
- 서비스 함수에서 인증 컨텍스트 없이 session-specific overlay 추가하는 패턴 금지.
- embed/link-preview 로직에서 새로운 외부 provider를 넣으면서 캐시/보안/테스트를 빼먹는 패턴 금지.

## 하위 경계

- `services/`: 서버 응답 shape를 만드는 집계 계층
- `link-preview/`: 외부 provider 파서와 캐시
- `realtime/`: OCI WebSocket topic/event 브로드캐스트
- `embeds/`: 포스트 본문 HTML 임베드 처리

## 빠른 체크

```bash
npx vitest run src/__tests__/lib src/__tests__/api/posts*.test.ts src/__tests__/api/post-*.test.ts
npx tsc --noEmit
```

## 노트

- `src/auth.ts`는 루트에 있지만 실질적으로 lib 권한 흐름과 강하게 결합됨.
- `link-preview/providers.ts`는 한국 서비스(DCinside) 포함이라 일반 OSS 예시랑 다를 수 있음.
