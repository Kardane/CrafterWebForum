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

- 헤더 타이틀 클릭 시 드롭다운에서 `스티브 갤러리 개발 포럼 Beta v0.2` / `스티브 갤러리 서버 신문고 Beta v0.1` 전환 가능
- `서버 신문고` 목록 페이지: `/ombudsman`
- `서버 신문고` 작성 페이지: `/ombudsman/new`
- 신문고 작성 시 `태그` 대신 `서버 주소(host:port)`를 입력 (형식 검증만 수행)
- 신문고 목록/상세에서 서버 주소 태그 클릭 시 클립보드 복사
- 신문고 상태(`/ombudsman`, `/posts/[id]?board=ombudsman`)에서는 키컬러/배경이 보라 톤으로 자동 전환
- 신문고 목록은 사용자 오버레이(읽음 카운트) 조회를 생략해 목록 응답 비용을 축소
- 신문고 무한 스크롤 페이지 캐시 키를 정규화해 동일 조건 재조회 시 캐시 적중률을 개선

서버 주소 확인 API

```bash
GET /api/server-address/check?address=mc.example.com:25565
```

- 성공 응답 예시: `{ ok: true, open: true|false, latencyMs: number, normalizedAddress: string }`
- 신문고 포스트는 내부 메타 태그(`__sys:board:ombudsman`, `__sys:server:<address>`)로 저장되며, 일반 태그 목록에서는 숨김 처리됨
