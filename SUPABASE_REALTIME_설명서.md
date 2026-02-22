# Supabase Realtime 설명서 (진짜 쉬운 버전)

## 0. 이 문서는 누구용?

- 웹소켓이 처음인 사람
- "실시간"이 뭔지 감이 없는 사람
- 초등학생도 이해할 수 있게 아주 쉽게 보고 싶은 사람

---

## 1. 한 줄 요약

- **Supabase Realtime = 같은 방에 있는 사람들끼리 소식지를 즉시 주고받는 무전기**

예시:

- A가 댓글을 쓰면, B 화면에도 바로 뜸
- A가 "나 지금 입력 중"이면, B 화면에 "입력 중..." 표시됨

---

## 2. 용어를 장난감 비유로 이해하기

- **Channel(채널)**: 같은 주제 친구들이 모인 방 이름
  - 예: `post:123`, `admin:inquiries`
- **Broadcast**: 방에 "소식" 보내기
  - 예: "댓글 추가됨"
- **Presence**: "내 상태" 알려주기
  - 예: "입력 중", "온라인"
- **RLS**: 출입 카드 검사
  - 들어와도 되는 사람만 들어오게 하는 문지기

---

## 3. 시작 준비물

1) Supabase 프로젝트 만들기
2) API 키 확인
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (또는 anon 키)
3) 패키지 설치

```bash
npm install @supabase/supabase-js @supabase/ssr
```

4) `.env.local`에 값 넣기

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

5) Supabase에서 Realtime 기능 켜기(중요)

- Dashboard -> `Database` -> `Replication`(Publications)
- `supabase_realtime` publication에 실시간 감지할 테이블 추가
  - 예: `comment`, `post`, `inquiry`, `inquiry_reply`, `user`, `postRead`, `like`

6) Supabase에서 Realtime 채널 생성 준비(권한)

- Dashboard -> `Realtime` -> `Settings`
- 처음에는 테스트를 위해 public 채널로 시작 가능
- 운영 배포 전에는 private 채널 + Authorization(RLS)로 전환 권장

7) 프로젝트 생성부터 키 확인까지 가장 쉬운 순서

1. `https://database.new`에서 프로젝트 생성
2. 프로젝트 Dashboard의 `Connect`에서 URL/키 복사
3. `.env.local`에 붙여넣기
4. 앱 재시작 (`npm run dev` 다시 실행)
5. 콘솔 에러 없이 채널 subscribe 되는지 확인

---

## 4. 가장 간단한 연결 코드

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
```

---

## 5. "방"에 들어가서 실시간 메시지 받기 (Broadcast)

```ts
const channel = supabase
  .channel("post:123")
  .on("broadcast", { event: "comment.created" }, (payload) => {
    console.log("새 댓글", payload);
  })
  .subscribe();
```

메시지 보내기:

```ts
await channel.send({
  type: "broadcast",
  event: "comment.created",
  payload: { postId: 123, commentId: 999 },
});
```

---

## 6. "입력 중" 만들기 (Presence)

핵심 아이디어:

- 키보드를 누르면 `typing: true`
- 잠깐 멈추면 `typing: false`
- 상대방은 Presence 상태를 보고 "입력 중..." 표시

```ts
const room = supabase
  .channel("post:123", {
    config: { presence: { key: "user-42" } },
  })
  .on("presence", { event: "sync" }, () => {
    const state = room.presenceState();
    console.log(state);
  })
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await room.track({ typing: false, userId: 42 });
    }
  });
```

---

## 7. 보안(RLS) 꼭 하기

- "아무나 다 듣기"는 위험함
- 채널을 private로 두고, RLS 정책으로 허용된 사람만 듣고 보내게 해야 함

예시 개념:

- 인증된 사용자만 `realtime.messages`에서 해당 topic 읽기/쓰기 허용

공식 문서 키워드:

- Realtime Authorization
- `private: true`
- `realtime.topic()`

추가로 꼭 기억:

- private 채널 쓰면 **인증된 사용자만 구독** 가능
- 정책이 없으면 구독 실패할 수 있음 (정상 동작)
- 운영에서는 public 채널보다 private 채널이 안전함

---

## 8. 우리 프로젝트에 바로 쓸 이벤트 이름 추천

- 댓글
  - `comment.created`
  - `comment.updated`
  - `comment.deleted`
  - `comment.pinned`
- 좋아요
  - `post.like.toggled`
- 읽음 마커
  - `post.readMarker.updated`
- 관리자
  - `admin.inquiry.pendingCount.updated`
  - `admin.user.approval.updated`
  - `admin.inquiry.status.updated`
- 입력 중
  - Presence payload: `{ typing: true|false, postId, userId }`

---

## 9. 실수 방지 체크리스트

- [ ] 채널 이름 규칙 정했는가? (`post:{id}`, `admin:{domain}`)
- [ ] private 채널 + RLS 적용했는가?
- [ ] 페이지 나갈 때 `removeChannel()`로 정리하는가?
- [ ] 메시지 페이로드에 꼭 필요한 값만 넣었는가?
- [ ] 실패 시 REST 재조회 fallback이 있는가?

---

## 10. 공식 문서(꼭 읽기)

- Next.js 연동: `https://supabase.com/docs/guides/realtime/realtime-with-nextjs`
- Broadcast: `https://supabase.com/docs/guides/realtime/broadcast`
- Presence: `https://supabase.com/docs/guides/realtime/presence`
- Postgres Changes: `https://supabase.com/docs/guides/realtime/postgres-changes`
- Realtime Authorization: `https://supabase.com/docs/guides/realtime/authorization`
- Next.js Quickstart: `https://supabase.com/docs/guides/getting-started/quickstarts/nextjs`

---

## 11. 마지막 한마디

- 처음에는 **댓글 + 입력중 표시**만 붙이고,
- 안정화되면 관리자 실시간으로 확장하면 가장 안전함.
