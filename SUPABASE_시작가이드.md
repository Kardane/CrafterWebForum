# Supabase 시작 가이드 (회원가입 직후 -> 우리 프로젝트 연결)

대상: Supabase 처음 가입했는데 "뭘 해야 하지" 상태인 사람용.

목표: CrafterWebForum(Next.js)에서 Supabase Realtime까지 붙여서 실시간 기능이 동작하는 상태 만들기.

---

## 1) Supabase에서 제일 먼저 할 일: 프로젝트 만들기

1. Supabase Dashboard 접속
2. `New project` 클릭
3. 아래 값 입력
   - `Name`: 아무거나(예: `crafter-forum`)
   - `Database Password`: 강한 비밀번호
   - `Region`: 사용자랑 가까운 곳(보통 Asia면 싱가폴/도쿄 쪽)
4. `Create new project` 누르고 생성 완료 기다리기

여기서 중요한 포인트.

- Supabase는 "프로젝트" 단위로 앱 하나가 붙는 구조임
- 지금 만드는 프로젝트 = 너희 사이트의 백엔드 한 세트임

---

## 2) 연결에 필요한 값 3개 찾기(복사할 것)

프로젝트 들어가서 `Connect` 또는 `Project Settings -> API`에서 아래 값 복사.

1) `Project URL`
2) `Publishable key` (없으면 `anon` key)
3) `service_role key`

주의.

- `service_role key`는 절대 브라우저(프론트)에 넣으면 안 됨
- 서버(API route)에서만 쓰는 "마스터 키"임

---

## 3) 우리 프로젝트(.env.local)에 값 넣기

이 레포는 아래 환경 변수 이름을 쓰는 구조임.

`.env.local`에 추가.

```env
NEXT_PUBLIC_SUPABASE_URL=여기에_Project_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=여기에_Publishable_key_또는_anon

# 서버에서만 사용(브라우저로 절대 노출 금지)
SUPABASE_SERVICE_ROLE_KEY=여기에_service_role_key
```

참고.

- 샘플은 `CrafterWebForum/.env.example`에도 추가돼 있음

---

## 4) Supabase에서 Realtime 켜기(실시간 준비)

Supabase Realtime는 크게 2가지가 있음.

- **Broadcast/Presence**: "채팅/입력중" 같은 즉시 신호
- **Postgres Changes**: DB 테이블이 바뀌면(INSERT/UPDATE/DELETE) 자동 알림

우리 프로젝트는 일단 Broadcast 방식으로 이벤트를 보내는 코드를 넣어둔 상태임.

### 4-1) Realtime 설정 확인

프로젝트에서:

- `Realtime -> Settings` 들어가기
- 처음 테스트는 public로 해도 되는데, 운영은 private + Authorization 추천임

### 4-2) (옵션) Postgres Changes도 쓸 거면 Replication 설정

프로젝트에서:

- `Database -> Replication`(또는 Publications) 들어가기
- `supabase_realtime` publication에서 테이블 선택

예시(쓸 가능성 높은 것).

- `comment`, `post`, `like`, `postRead`, `inquiry`, `inquiry_reply`, `user`

이건 "DB 변경 감지"를 쓸 때만 필요함.

---

## 5) 우리 프로젝트에서 어떤 기능이 실시간으로 바뀌냐(현재 구현 기준)

Supabase 키가 설정돼 있으면, 서버가 Realtime로 이벤트를 쏴줌.

1) 댓글 실시간
- 새 댓글/수정/삭제/고정

2) 관리자 실시간
- 문의 pending-count 갱신
- 유저 승인/거절/수정 반영

3) 좋아요 실시간
- 좋아요 수 갱신

4) 읽음 마커 실시간
- 포스트 진입/댓글 작성 시 내 readMarker 갱신

5) 문의 답변/상태 실시간
- 답변 추가/상태 변경 시 목록/상세 갱신

6) 입력중 표시(typing)
- 댓글 입력창 타이핑하면 다른 사람 화면에 "입력 중" 표시

---

## 6) 마지막 체크(문제 생기면 여기부터)

### A. 아예 아무 반응이 없음

- `.env.local`에 3개 값이 들어갔는지 확인
- `NEXT_PUBLIC_SUPABASE_URL` 오타(https 포함) 없는지 확인
- 브라우저 콘솔/서버 로그에 Supabase 관련 에러 있는지 확인

### B. 일부만 반영됨

- Realtime Settings(public/private) 확인
- (private 쓰는 경우) Authorization/RLS 정책 없으면 구독 실패할 수 있음

### C. 보안

- `SUPABASE_SERVICE_ROLE_KEY`가 프론트로 노출되면 끝장임
- 이 키는 서버만. 절대 클라 코드에 import 하지 말기

---

## 7) 관련 문서(이미 레포에 있음)

- Realtime 쉬운 설명: `CrafterWebForum/SUPABASE_REALTIME_설명서.md`
