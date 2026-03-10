# API 라우트 가이드

## 개요

`src/app/api`는 인증, 관리자, 포스트, 댓글, 푸시, 실시간, 업로드를 모두 담는 서버 진입면.
라우트 파일은 검증/권한/응답 조합에 집중하고, 무거운 계산은 `src/lib` 쪽으로 넘기는 편.

## 어디부터 볼지

| 작업 | 위치 | 메모 |
|------|------|------|
| 포스트 목록/작성 | `posts/route.ts`, `posts/[id]/**` | 서비스 계층 연결 핵심 |
| 댓글 CRUD/핀 | `posts/[id]/comments/route.ts`, `comments/[id]/route.ts`, `comments/[id]/pin/route.ts` | 실시간 이벤트와 revalidate 포함 |
| 인증/회원 | `auth/**`, `users/me/**` | old endpoint는 `410` 호환층 일부 존재 |
| 관리자 | `admin/**` | `requireAdmin()` 기준 권한 분리 |
| 푸시/스케줄러 | `push/**`, `jobs/push-dispatch/route.ts` | 토큰/배치/재시도 흐름 |
| 사이드바/링크프리뷰/업로드 | `sidebar/**`, `link-preview/route.ts`, `upload/route.ts` | 외부 입력/네트워크 가드 많음 |

## 컨벤션

- 인증된 일반 사용자 API는 `auth()` 뒤 `resolveActiveUserFromSession()`로 승인/밴 상태까지 정리하는 패턴 우선.
- JSON body는 `readJsonBody()` + `zod.safeParse()` 조합 사용.
- 숫자 params는 `Number.parseInt` 후 `<= 0`까지 검증.
- 변경형 라우트는 가능하면 `safeRevalidateTags()`와 실시간 broadcast를 같이 검토.
- stale schema 대응이 필요한 라우트는 `db-schema-guard.ts` 분기 유지.
- 에러 응답은 내부 예외 노출 없이 `{ error: ... }` 중심으로 통일.

## 이 디렉터리 안티패턴

- `request.json()` 직접 호출 남발 금지. 바이트 제한 빠짐.
- 승인 필요 라우트에서 `requireApproved: false`를 습관적으로 쓰는 패턴 금지.
- 관리자 라우트에서 공개 라우트와 같은 에러/권한 흐름 재사용 금지. `requireAdmin()` 먼저.
- 외부 URL/endpoint를 받는 API에서 `assertSafeHttpUrl()` 또는 유사 검증 생략 금지.
- Post/Comment 변경 후 `updatedAt`, `commentCount`, cache tags, realtime payload 중 일부만 고치는 반쪽 수정 금지.

## 빠른 체크

```bash
npx vitest run src/__tests__/api
npx tsc --noEmit
npm run build
```

## 노트

- `GET /api/posts`와 상세/사이드바는 모두 subscription/read overlay를 얹기 때문에 회귀 범위가 넓음.
- 구 API 제거는 삭제 대신 `410 gone`으로 남긴 케이스 있음. 기존 클라이언트 호환성 확인 필요.
