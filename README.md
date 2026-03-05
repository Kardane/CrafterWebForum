# CrafterWebForum (Linux/WSL Setup)

현재 저장소는 Linux/WSL 기준 개발 흐름을 기본값으로 사용함

## 1) Prerequisites

- Linux or WSL2 Ubuntu
- Node.js 20+
- npm 10+

Check versions

```bash
node -v
npm -v
```

## 2) Quick start

Run at repository root

```bash
npm run setup
```

`setup` does the following

- dependency install
- `.env.local` bootstrap from `.env.example` when missing
- automatic `NEXTAUTH_SECRET` generation when placeholder is found
- Prisma generate and db push
- Playwright Chromium install
- local environment doctor checks

Skip Playwright install when needed

```bash
npm run setup:local:skip-playwright
```

## 3) Required environment values

After setup, verify `.env.local`

- `NEXTAUTH_SECRET`: auto-generated on first setup
- `DATABASE_URL`: local default `file:./dev.db`

Generate a secret manually

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 4) Daily commands

```bash
npm run doctor
npm run dev
npm run lint
npm test
npm run build
```

E2E

```bash
npm run test:e2e
```

## 5) Database commands

```bash
npm run db:setup
npm run db:migrate:turso -- --dry-run
```

## 6) Helper scripts

Linux/WSL helper wrappers are now project-root relative

- `./setup.sh`
- `./run_dev.sh`
- `./run_test_wsl.sh`
- `./npm_wsl.sh`

## 7) Windows legacy script

Windows PowerShell bootstrap is still available for compatibility

```powershell
npm run setup:win
```

## 8) 서버 신문고 기능

- 2026-03 기준 신문고 기능은 본 프로젝트에서 제거됨

## 9) Web Push + GitHub Actions Scheduler 알림 전달

- 브라우저 종료 상태 알림 전달을 위해 Web Push + Service Worker + Outbox 디스패치 경로를 사용
- 구독 API
  - `GET /api/push/subscribe` (내 활성 구독 목록 조회)
  - `POST /api/push/subscribe`
  - `POST /api/push/unsubscribe`
- 디스패치 API (GitHub Actions scheduler 호출)
  - `GET /api/jobs/push-dispatch`
  - `POST /api/jobs/push-dispatch`
- 워크플로우: `.github/workflows/push-dispatch.yml`
- 스케줄: 5분 주기 (`*/5 * * * *`) + 수동 실행(`workflow_dispatch`)
- 실패 시 최대 2회 재시도(총 3회 시도)

필수 환경 변수

```bash
VAPID_PUBLIC_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
CRON_SECRET=...
```

- `CRON_SECRET`은 `Authorization: Bearer <CRON_SECRET>` 헤더 검증에 사용
- `PUSH_DISPATCH_URL` GitHub Actions secret에 프로덕션 엔드포인트 URL 설정 필요
- 푸시 payload에는 민감정보를 넣지 않고 `notificationId`/`targetUrl` 중심으로 처리
- 내 정보(`/profile`)에서 푸시 구독 버튼/구독 정보(권한, 현재 브라우저 구독, 활성 구독 목록) 확인 가능

Turso 운영 점검

- 배포 전 점검: `npm run check:deploy -- --with-db` (Turso 연결 + 필수 push 테이블 존재 여부 확인)
- `db_schema_not_ready` 오류가 나오면 Turso에 스키마를 적용

```bash
DATABASE_URL="$TURSO_DATABASE_URL" TURSO_AUTH_TOKEN="$TURSO_AUTH_TOKEN" npx prisma db push
```

보안 하드닝

- Markdown 링크/이미지는 `http/https/mailto`(링크), `http/https`(이미지/링크 공통) 허용 정책으로 스킴 필터링
- 외부 링크는 `rel="noopener noreferrer"` 적용
- Push 구독 endpoint는 `https` + 비로컬/사설망 endpoint만 허용
- `POST /api/push/subscribe`는 이미 등록된 endpoint의 소유자 불일치 시 `409` 반환
- `GET /api/push/subscribe`에도 레이트리밋 적용
- Cron 인증 비교는 SHA-256 digest 기반 timing-safe 비교 사용
- 닉네임 기반 관리자 자동 승격 정책 제거 (`isPrivilegedNickname`는 항상 false 반환)
- `POST /api/auth/callback/credentials` 로그인 시도에 레이트리밋(`authLogin`) 적용

성능 최적화 (P1)

- `GET /api/admin/stats`는 일별 추세 계산 시 전량 `findMany` 대신 DB 집계(`strftime + COUNT`)를 사용
- `POST /api/posts/[id]/comments`의 멘션 후처리는 `notificationDelivery`를 행별 upsert 대신 `createMany` 배치 적재
- `GET /api/posts/[id]/comments`는 `limit/cursor` 쿼리 파라미터로 루트 댓글 커서 페이지네이션 지원

## 10) 댓글 삭제 권한

- 댓글 삭제 API(`DELETE /api/comments/[id]`)는 작성자 또는 관리자만 허용
- 비인증: `401`, 비권한: `403`, 대상 없음: `404`

서버 주소 확인 API

```bash
GET /api/server-address/check?address=mc.example.com:25565
```

- 성공 응답 예시: `{ ok: true, open: true|false, latencyMs: number, normalizedAddress: string }`
- 서버 주소 확인 API는 포럼 공용 유틸리티로 유지됨
