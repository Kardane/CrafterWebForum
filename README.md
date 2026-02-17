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
