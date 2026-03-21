# 개인 호스팅 cron 푸시 디스패치 설정 가이드

## 목적
- GitHub Actions 대신 개인 호스팅 리눅스 서버의 `cron`으로 푸시 디스패치를 돌리는 방법을 설명하는 문서
- 서버 운영이 익숙하지 않은 사람도 그대로 따라 하면 설정할 수 있게 만드는 문서

## 이 문서가 필요한 이유
- 지금 운영 스케줄러는 `POST /api/jobs/comment-side-effects`와 `POST /api/jobs/push-dispatch`를 주기적으로 호출해줘야 동작함
- GitHub Actions를 쓰면 보통 5분 주기라서 알림이 늦을 수 있음
- 개인 서버의 `cron`을 쓰면 1분 주기로 더 자주 호출 가능함
- 이미 서버 코드에 인증, 큐 처리, 재시도 로직이 있으니 스케줄러만 바꾸면 됨

## 이 문서의 기준 주소
- 웹서비스 주소: `https://stevegalleryforum.vercel.app`
- 개인 호스팅 서버 주소: `mcbrass.kro.kr`
- 실제 호출 주소
  - `POST https://stevegalleryforum.vercel.app/api/jobs/comment-side-effects?batch=50`
  - `POST https://stevegalleryforum.vercel.app/api/jobs/push-dispatch?batch=100`
- 필수 헤더: `Authorization: Bearer <CRON_SECRET>`

## 먼저 알아둘 것
- 이 문서는 실제 리눅스 서버 기준 설명임
- WSL 개발 환경 설명 문서가 아님
- `cron`은 서버가 정해진 시간마다 명령을 자동 실행하게 만드는 기능임
- 여기서는 1분마다 푸시 디스패치 API를 호출하게 만들 것임

## 준비물
- 리눅스 서버 셸 접근 권한
- 서버에 `curl` 설치
- 배포 환경에서 사용 중인 `CRON_SECRET`
- 앱 서버에 아래 환경 변수가 이미 설정되어 있어야 함

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
CRON_SECRET=...
```

주의
- `CRON_SECRET`이 틀리면 `unauthorized`가 뜸
- VAPID 관련 값이 없으면 `push_env_not_configured`가 뜸
- DB 테이블이 준비되지 않았으면 `db_schema_not_ready`가 뜰 수 있음

## 1. 수동 호출부터 먼저 확인
자동 설정 전에 수동 호출이 되는지 먼저 확인하는 게 맞음.

아래 명령을 `mcbrass.kro.kr` 서버에서 직접 실행:

```bash
curl -sS -X POST "https://stevegalleryforum.vercel.app/api/jobs/comment-side-effects?batch=50" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"

curl -sS -X POST "https://stevegalleryforum.vercel.app/api/jobs/push-dispatch?batch=100" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

성공하면 보통 이런 형태의 JSON이 돌아옴.

```json
{
  "ok": true,
  "batchSize": 50,
  "processed": 0,
  "completed": 0,
  "retried": 0,
  "dead": 0,
  "skipped": 0
}
```

실패 예시
- `{"error":"unauthorized"}`: `CRON_SECRET` 확인 필요
- `{"error":"push_env_not_configured"}`: VAPID 환경 변수 확인 필요
- `{"error":"db_schema_not_ready"}`: DB 스키마 반영 상태 확인 필요

## 2. secret을 파일로 분리
`CRON_SECRET`을 crontab 본문에 바로 적지 않는 편이 더 안전함.

예시 경로:
- 스크립트: `/opt/crafter/scripts/push-dispatch.sh`
- secret 파일: `/opt/crafter/secrets/cron_secret`
- 로그 파일: `/opt/crafter/logs/push-dispatch.log`

디렉토리 생성:

```bash
sudo mkdir -p /opt/crafter/scripts
sudo mkdir -p /opt/crafter/secrets
sudo mkdir -p /opt/crafter/logs
```

현재 로그인한 사용자 기준으로 실행할 수 있게 소유권 변경:

```bash
sudo chown -R "$USER":"$USER" /opt/crafter
```

secret 파일 작성:

```bash
sudo sh -c 'printf "%s" "YOUR_CRON_SECRET" > /opt/crafter/secrets/cron_secret'
```

권한 설정:

```bash
sudo chmod 600 /opt/crafter/secrets/cron_secret
```

이 설정의 의미:
- `crontab -e`는 보통 현재 로그인한 사용자 기준으로 등록됨
- 그래서 스크립트, secret, 로그 경로도 그 사용자가 읽고 실행할 수 있어야 함

## 3. 실행 스크립트 만들기
아래 내용을 `/opt/crafter/scripts/push-dispatch.sh`에 저장:

```bash
#!/usr/bin/env bash
set -eu

APP_URL="https://stevegalleryforum.vercel.app"
SECRET_FILE="/opt/crafter/secrets/cron_secret"

CRON_SECRET="$(cat "$SECRET_FILE")"

curl -sS -X POST "${APP_URL}/api/jobs/comment-side-effects?batch=50" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"

echo

curl -sS -X POST "${APP_URL}/api/jobs/push-dispatch?batch=100" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

실행 권한 부여:

```bash
sudo chmod 700 /opt/crafter/scripts/push-dispatch.sh
```

중요
- `APP_URL`은 반드시 `https://stevegalleryforum.vercel.app`로 둠
- `comment-side-effects`는 `batch=50`, `push-dispatch`는 `batch=100`이 현재 기본 권장값임
- 스크립트 안에 `CRON_SECRET` 문자열을 직접 박아 넣지 않는 편이 좋음

## 4. 스크립트 수동 실행
cron에 넣기 전에 스크립트 단독 실행이 되는지 확인:

```bash
/opt/crafter/scripts/push-dispatch.sh
```

정상이라면 JSON 응답이 출력됨.

에러가 나면 먼저 이것부터 해결하고 다음 단계로 가면 됨.

## 5. cron 등록
이제 1분마다 자동 실행되게 등록하면 됨.

crontab 열기:

```bash
crontab -e
```

아래 한 줄 추가:

```cron
* * * * * /opt/crafter/scripts/push-dispatch.sh >> /opt/crafter/logs/push-dispatch.log 2>&1
```

뜻
- `* * * * *`: 1분마다 실행
- `>> /opt/crafter/logs/push-dispatch.log`: 실행 결과를 로그 파일에 계속 추가
- `2>&1`: 오류도 같은 로그 파일에 같이 기록

왜 1분 주기를 추천하냐면:
- GitHub Actions 5분 주기보다 훨씬 빠름
- 보통 체감 딜레이를 최대 1분 수준으로 줄일 수 있음

## 6. cron이 진짜 등록됐는지 확인
현재 사용자 crontab 확인:

```bash
crontab -l
```

아까 넣은 한 줄이 보이면 등록된 것임.

로그 확인:

```bash
tail -f /opt/crafter/logs/push-dispatch.log
```

여기서 JSON 응답이나 오류 메시지를 확인 가능함.

## 7. 성공 확인 방법
아래 순서로 보는 게 제일 쉬움.

1. `/profile`에서 푸시 구독 켜기
2. 다른 계정으로 댓글이나 멘션 만들기
3. DB에서 `CommentSideEffectJob(status=queued)` 생성 확인
4. 1분 안쪽으로 cron이 실행되면 `queued -> done`으로 바뀌는지 확인
5. 그다음 `NotificationDelivery(status=queued)`가 생성되고 `sent`로 바뀌는지 확인
6. 브라우저를 닫은 상태에서도 실제 OS 푸시 알림이 오는지 확인

이미 있는 검증 문서도 같이 보면 됨.
- `보고서/PUSH_NOTIFICATION_OPERATION_CHECKLIST.md`
- `보고서/BROWSER_CLOSED_PUSH_TEST_SCENARIO.md`

## 8. 자주 나오는 장애와 해결
### `unauthorized`
- 원인: `Authorization` 헤더 값이 서버의 `CRON_SECRET`과 다름
- 확인할 것:
  - `/opt/crafter/secrets/cron_secret` 내용
  - 앱 서버 환경 변수 `CRON_SECRET`
  - 공백이나 줄바꿈이 섞이지 않았는지

### `push_env_not_configured`
- 원인: VAPID 환경 변수가 빠졌거나 잘못됨
- 확인할 것:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`

### `db_schema_not_ready`
- 원인: 푸시 관련 테이블이 아직 준비되지 않음
- 확인할 것:
  - `CommentSideEffectJob`
  - `PushSubscription`
  - `Notification`
  - `NotificationDelivery`
  - `PostSubscription`

### 로그만 보고 싶을 때
- 최근 로그 끝부분 확인:

```bash
tail -n 50 /opt/crafter/logs/push-dispatch.log
```

## 9. 운영 팁
- `CRON_SECRET`은 코드, README, 공개 저장소에 적지 않는 게 맞음
- 서버 시간이 틀어져 있으면 재시도 시각 계산이 꼬일 수 있으니 시간 동기화가 필요함
- 댓글은 먼저 저장되고 알림은 worker가 뒤에서 처리하므로, 댓글 작성 직후 알림 배지가 약간 늦게 보이는 건 정상일 수 있음
- 푸시가 많이 밀리면 `batch=100`으로 부족할 수 있음. 그때만 배치 크기 조정 검토
- 1분 주기로 돌려도 서버 내부 재시도 로직은 별도로 살아 있음
- 만료된 구독은 전송 중 `404`나 `410`이 나오면 자동 비활성화될 수 있음

## 10. GitHub Actions와 같이 써도 되나
가능은 함. 하지만 보통 하나만 쓰는 편이 낫다.

이유
- GitHub Actions와 cron을 동시에 돌리면 둘 다 같은 큐를 호출할 수 있음
- 현재 서버는 `processing` 상태로 먼저 claim해서 일부 중복 처리를 막고 있음
- 그래도 운영 구조는 괜히 복잡해짐

추천 방식
- cron 전환이 안정적으로 확인된 뒤에는 GitHub Actions 스케줄러는 끄는 편이 깔끔함
- 단, cron이 제대로 동작하는지 먼저 수동 확인과 실제 푸시 수신 확인을 끝내고 끄는 게 맞음

## 11. 제일 쉬운 최종 점검 순서
아무것도 모르겠으면 아래 순서대로만 보면 됨.

1. 앱 서버 환경 변수 확인
2. `curl` 수동 호출 성공 확인
3. secret 파일 생성
4. 스크립트 생성
5. `chmod 600`, `chmod 700` 적용
6. 스크립트 단독 실행 확인
7. `crontab -e`로 1분 주기 등록
8. `tail -f /opt/crafter/logs/push-dispatch.log`로 worker 로그 확인
9. 실제 댓글/멘션으로 푸시 수신 확인

여기까지 되면 개인 호스팅 cron 전환은 끝임.
