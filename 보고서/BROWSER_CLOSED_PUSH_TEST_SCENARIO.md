# 브라우저 종료 상태 푸시 알림 검증 시나리오

## 목적
- 사용자가 브라우저를 닫아도 새 댓글 알림을 실제로 받는지 수동으로 검증하는 시나리오

## 준비물
- 테스트 계정 2개
- 구독 대상 포스트 1개
- 푸시 권한 허용 가능한 Chromium 기반 브라우저 1개
- 배포 환경 접근 가능 주소

## 시나리오 1. 구독 댓글 푸시
1. 계정 A로 로그인
2. 대상 포스트에서 `포스트 알림 켜기`
3. `/profile`에서 푸시 구독 토글을 켜고 권한을 허용
4. `PushSubscription` row 생성 확인
5. 브라우저 탭을 모두 닫거나 브라우저를 완전히 종료
6. 계정 B로 같은 포스트에 새 댓글 작성
7. 최대 5분 이내 또는 수동 `push-dispatch` 실행 후 계정 A 기기에서 OS 푸시 알림 수신 확인
8. 푸시 클릭 시 해당 포스트의 최신 댓글 위치로 이동하는지 확인

성공 기준
- 푸시 제목이 `새 댓글 · <글 제목>` 형태
- 본문이 `<작성자>님이 구독 중인 글에 새 댓글 남김` 형태
- 클릭 시 대상 댓글로 이동

## 시나리오 2. 멘션 푸시
1. 계정 A는 푸시 구독 유지
2. 브라우저 종료 상태 유지
3. 계정 B가 댓글에서 계정 A를 멘션
4. `Notification(type=mention_comment)`와 `NotificationDelivery(status=queued)` 생성 확인
5. 디스패치 후 계정 A 기기에서 OS 푸시 알림 수신 확인

성공 기준
- 푸시 제목이 `멘션 알림 · <글 제목>` 형태
- 본문이 `<작성자>님이 회원님을 멘션했음`
- 클릭 시 멘션 댓글 위치로 이동

## 실패 시 수집할 증거
- `PushSubscription` 존재 여부 및 `isActive` 값
- `Notification` 생성 여부
- `NotificationDelivery`의 `status`, `attemptCount`, `lastErrorCode`, `lastErrorMessage`
- GitHub Actions `Push Dispatch Scheduler` 실행 로그
- 브라우저 권한 상태와 OS 알림 차단 여부

## 주의사항
- 브라우저별 정책 차이로 “브라우저 완전 종료” 동작은 다를 수 있음
- Safari/iOS는 Web Push 제약이 커서 Chromium/Edge 먼저 확인하는 것이 안전
- 서비스워커/알림 권한을 한 번 거부하면 재허용 절차가 브라우저 설정에 의존함
