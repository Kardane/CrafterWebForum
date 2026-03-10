# 테스트 가이드

## 개요

`src/__tests__`는 Vitest 기반 단위/통합 테스트 묶음.
API, components, lib로 나뉘고 루트 `setup.ts`가 공통 DOM 정리 담당.

## 구조

```text
src/__tests__/
├── api/          # route 테스트 다수
├── components/   # React 컴포넌트/interaction 테스트
├── lib/          # 순수 유틸, 보안, 캐시, markdown 테스트
└── setup.ts      # jest-dom + cleanup
```

## 컨벤션

- 파일명은 `*.test.ts` 또는 `*.test.tsx`.
- 모듈 mocking은 `vi.mock()` + 상단 `const ...Mock = vi.fn()` 패턴이 기본.
- `beforeEach`에서 `mockReset()`과 기본 resolved value 세팅을 반복하는 스타일 유지.
- API 테스트는 route 파일 import 후 `Request`/`NextRequest` 모사로 직접 호출하는 편.
- Prisma 의존은 실제 DB보다 mock prisma object로 고립하는 경향 강함.

## 어디부터 볼지

| 작업 | 위치 | 메모 |
|------|------|------|
| API 회귀 | `api/` | auth, posts, comments, push, sidebar 집중 |
| UI 회귀 | `components/` | 댓글/포스트/아바타/외부 프리뷰 중심 |
| 코어 유틸 | `lib/` | network-guard, markdown, comment-tree, env 등 |

## 이 디렉터리 안티패턴

- 한 테스트 파일 안에서 mock 초기화 순서를 제멋대로 섞는 패턴 금지.
- route 테스트에서 성공/실패 분기 하나만 보고 fallback 분기 누락 금지.
- component 테스트에서 DOM cleanup을 수동으로 추가 중복하는 패턴 금지. `setup.ts`가 이미 처리.

## 빠른 체크

```bash
npx vitest run src/__tests__/api
npx vitest run src/__tests__/components
npx vitest run src/__tests__/lib
```

## 노트

- 루트 `AGENTS.md`의 TDD/coverage 요구가 이 디렉터리에 그대로 적용됨.
- stale schema fallback, auth pending/banned, notification queue 누락 같은 운영 회귀를 테스트로 고정해둔 편.
