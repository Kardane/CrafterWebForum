# 푸시 알림 운영 점검 체크리스트

## 목적
- 브라우저가 닫힌 상태에서도 새 댓글/멘션 푸시 알림이 정상 전달되는지 배포 환경에서 점검하기 위한 체크리스트

## 사전 환경 확인
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`가 배포 환경에 설정되어 있는지 확인
- GitHub Actions `push-dispatch.yml`의 `PUSH_DISPATCH_URL`, `CRON_SECRET` secret가 설정되어 있는지 확인
- 배포 환경 DB에 `PushSubscription`, `Notification`, `NotificationDelivery`, `PostSubscription` 테이블이 존재하는지 확인
- `/profile`에서 푸시 구독 토글 UI가 보이는지 확인

## 사용자 구독 상태 확인
- 테스트 계정으로 로그인 후 `/profile` 진입
- 브라우저 알림 권한이 `허용` 상태인지 확인
- 푸시 구독 토글을 켠 뒤 활성 구독이 1건 이상 보이는지 확인
- 서버 DB에서 해당 사용자의 `PushSubscription.isActive = 1` row가 생성되었는지 확인

## 알림 생성 확인
- 멘션 댓글 작성 후 `Notification(type=mention_comment)` 생성 확인
- 구독 글 댓글 작성 후 `Notification(type=post_comment)` 생성 확인
- 두 경우 모두 `NotificationDelivery(channel=web_push, status=queued)`가 생성되는지 확인

## 디스패치 확인
- GitHub Actions `Push Dispatch Scheduler` 최근 실행이 성공인지 확인
- 필요 시 `/api/jobs/push-dispatch?batch=100`를 `Authorization: Bearer <CRON_SECRET>`로 수동 호출
- 호출 후 `NotificationDelivery.status`가 `queued -> sent`로 바뀌는지 확인
- 404/410 응답이 난 subscription은 `PushSubscription.isActive = 0`으로 비활성화되는지 확인

## 사용자 경험 확인
- 푸시 알림 제목이 `멘션 알림 · <글 제목>` 또는 `새 댓글 · <글 제목>` 형태로 보이는지 확인
- 푸시 알림 본문이 generic 문구가 아니라 실제 `Notification.message`를 반영하는지 확인
- 알림 클릭 시 해당 포스트/댓글로 이동하는지 확인

## 장애 대응 기준
- `push_env_not_configured`: VAPID 환경 변수 누락 점검
- `unauthorized`: `CRON_SECRET` 불일치 점검
- `db_schema_not_ready`: Prisma 스키마 반영 상태 점검
- `dead` 누적 증가: 만료된 push subscription 비율과 특정 브라우저군 집중 여부 점검
