# 댓글 UI 가이드

## 개요

이 디렉터리는 일반 컴포넌트 묶음이 아니라 작은 기능 서브시스템에 가까움.
트리 댓글, 실시간 반영, draft, 파일 업로드, pinned modal, read marker, thread collapse 규칙이 함께 움직임.

## 어디부터 볼지

| 작업 | 위치 | 메모 |
|------|------|------|
| 전체 오케스트레이션 | `CommentSection.tsx` | 스크롤, realtime, pagination, marker 중심 |
| 입력/첨부/드래프트 | `CommentForm.tsx` | 가장 큰 파일, 부수효과 많음 |
| 단일 댓글 렌더/액션 | `CommentItem.tsx` | edit/delete/reply/pin/poll 다 모임 |
| mutation 분리 | `useCommentMutations.ts` | 서버 호출/상태 갱신 |
| scroll/jump 분리 | `useCommentScroll.ts` | hash jump, latest comment 이동 |
| 스타일 규칙 | `comment-section.styles.ts` | 클래스 문자열 CSS 소스 |

## 컨벤션

- 댓글 관련 큰 로직은 `CommentSection`에 다 때려넣기보다 이미 있는 hook/helper로 나누는 방향 유지.
- 행 렌더는 `RenderRow`류 파생 데이터로 구성하고, 실제 JSX 분기는 그 결과를 소비하는 패턴 유지.
- 스타일은 Tailwind만으로 안 되는 공통 규칙을 `comment-section.styles.ts` 문자열에 둠.
- 실시간 이벤트는 `REALTIME_EVENTS` / `REALTIME_TOPICS` 기준으로만 연결.
- 특정 댓글로 점프할 때는 URL hash + visible range + thread expand를 같이 맞춰야 함.

## 이 디렉터리 안티패턴

- 댓글 트리 조작을 컴포넌트 곳곳에서 중복 구현하는 패턴 금지. 기존 tree helper 재사용.
- 새 댓글/수정/삭제 흐름에서 local state만 바꾸고 realtime/reload fallback을 빼먹는 패턴 금지.
- 긴 CSS를 `style jsx`로 아무 파일에나 새로 박는 패턴 금지. 기존 `.styles.ts` 우선.
- draft/typing/upload/poll 상태를 한 effect에 뒤섞는 패턴 금지.

## 테스트 감

```bash
npx vitest run src/__tests__/components/CommentSection* src/__tests__/components/CommentDateDividerRow.test.tsx src/__tests__/components/ReadMarkerRow.test.tsx
```

## 노트

- `CommentForm.tsx`, `CommentSection.tsx`, `CommentItem.tsx` 셋이 모두 600~800줄대라 수정 범위가 쉽게 커짐.
- read marker, pinned modal, thread collapse는 서로 별개처럼 보여도 스크롤 UX에서 얽힘.
