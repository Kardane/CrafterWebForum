# 운영 스크립트 가이드

## 개요

이 디렉터리는 로컬 bootstrap, DB setup, Turso 마이그레이션, Blob 이전, 배포 readiness 점검을 담당.
앱 코드보다 운영 상태 가정이 더 중요함.

## 어디부터 볼지

| 작업 | 위치 | 메모 |
|------|------|------|
| 로컬 초기 세팅 | `setup-local.mjs` | npm install, env 준비, prisma, playwright, doctor 체인 |
| 로컬 상태 진단 | `doctor-local.mjs` | Node/env/db 비정상 탐지 |
| 배포 전 점검 | `check-deploy-readiness.mjs` | `--with-db`면 Turso 연결/테이블/무결성 검증 |
| SQLite -> Turso | `migrate-sqlite-to-turso.mjs` | dry-run, 청크, FK 순서 중요 |
| Push 스키마 복구 | `repair-turso-push-schema.mjs` | 배포 스키마 불일치 대응 |
| 데이터 백필/이전 | `backfill-post-comment-count.mjs`, `apply-oracle-legacy-data.mjs`, `migrate-uploads-to-blob.mjs` | 운영성 강함 |

## 컨벤션

- 마이그레이션 계열은 가능하면 `--dry-run` 먼저.
- Node 20+ 가정. `setup-local.mjs`가 직접 검사함.
- `.env.example` -> `.env.local` 복사 및 `NEXTAUTH_SECRET` 자동 생성 흐름을 깨지 말 것.
- Turso 관련 스크립트는 `DATABASE_URL`/`TURSO_AUTH_TOKEN` 둘 다 맞아야 의미 있음.

## 이 디렉터리 안티패턴

- 운영 스크립트에서 민감정보를 로그에 그대로 출력하는 패턴 금지.
- target DB 상태 확인 없이 migrate 스크립트를 바로 돌리는 패턴 금지.
- readiness 체크를 통과 못한 상태에서 배포 강행 패턴 금지.
- setup 스크립트에서 로컬 기본값(`file:./dev.db`)을 바꾸고 README/doctor를 안 맞추는 패턴 금지.

## 자주 쓰는 명령

```bash
npm run setup
npm run doctor
npm run db:setup
npm run db:migrate:turso -- --dry-run
npm run check:deploy -- --with-db
```

## 노트

- Windows 호환은 `setup-windows.ps1`만 제한적으로 유지. 기본 개발 가정은 Linux/WSL.
- `check-deploy-readiness.mjs`는 push 테이블, `Post.commentCount`, null tags까지 점검함.
