# 프로젝트 리뷰 발견 사항 및 조치 계획

작성일: 2026-04-24

## 요약

이번 리뷰에서 가장 위험한 항목은 마인크래프트 인증 콜백이 서버 비밀값 없이 임의 `code`/`nickname`/`uuid`를 검증 처리할 수 있는 문제다. 이 경로는 비밀번호 재설정 API가 `linkedNickname`을 신뢰하는 구조와 결합되어 계정 탈취로 이어질 수 있으므로 최우선으로 수정한다.

## 발견 사항

| 우선순위 | 항목 | 위치 | 영향 | 1차 조치 |
| --- | --- | --- | --- | --- |
| P0 | 마인크래프트 인증 우회로 계정 탈취 가능 | `src/app/api/minecraft/verify/route.ts`, `src/app/api/auth/password/forgot/route.ts` | 외부 사용자가 임의 닉네임을 검증 코드에 연결한 뒤 비밀번호 재설정을 수행할 수 있음 | `MINECRAFT_VERIFY_SECRET` 기반 Bearer 인증 추가, 배포 전 환경 점검에 포함 |
| P1 | 댓글 수정/삭제가 stale JWT 권한을 신뢰함 | `src/app/api/comments/[id]/route.ts` | 차단되거나 강등된 사용자가 JWT 만료 전까지 댓글 권한을 행사할 수 있음 | 요청 시점 DB 사용자 상태/역할 재조회 |
| P1 | 업로드 비용 DoS 방어 부족 | `src/app/api/upload/route.ts` | 인증 사용자 하나가 Blob 저장소 비용과 이미지 처리 CPU를 과도하게 사용할 수 있음 | 업로드 endpoint rate limit, 사용자별 일일/월간 quota, 파일 수/크기 정책 추가 |
| P1 | 댓글 전체 로드 경로 | `src/app/api/posts/[id]/comments/route.ts` | 댓글 많은 글에서 응답 크기, Turso 왕복, 서버리스 실행 시간이 급증할 수 있음 | 기본 limit/cursor 강제, 초기 렌더와 추가 로드 분리 |
| P1 | 운영 스케줄러 자동 실행 누락 | `.github/workflows/push-dispatch.yml` | 푸시 큐와 댓글 후처리 큐가 자동으로 비워지지 않음 | `schedule` 트리거 복구, 두 job 모두 호출하도록 워크플로우 점검 |
| P1 | 모달 접근성 골격 부재 | `src/components/ui/Modal.tsx` | 삭제 확인, 도움말, 라이트박스에서 스크린리더/키보드 사용성이 반복 저하됨 | `role="dialog"`, `aria-modal`, label 연결, focus trap/복귀 구현 |
| P1 | 외부 URL 처리의 DNS 재검증 부족 | `src/lib/link-preview/`, `src/lib/network-guard.ts` | DNS rebinding류 SSRF 방어가 호출 시점과 실제 fetch 시점 사이에서 약해질 수 있음 | fetch 직전 IP 재검증 또는 안전한 fetch 어댑터 단일화 |
| P1 | 피드/사이드바 집계 비용 증가 가능 | `src/lib/services/posts-service.ts`, `src/lib/services/sidebar-tracked-posts-service.ts` | 데이터 증가 시 N+1/집계 쿼리 비용으로 홈 응답이 느려질 수 있음 | 집계 캐시, 필요한 필드 축소, pagination 기준 명확화 |
| P2 | 검색이 구조화되지 않은 텍스트 스캔에 가까움 | `src/lib/services/posts-service.ts` | 글 수 증가 시 검색 응답 시간이 선형으로 증가할 수 있음 | FTS 또는 별도 search index 검토 |
| P2 | UI 대형 컴포넌트 유지보수 부담 | `src/components/comments/CommentSection.tsx`, `src/components/comments/CommentForm.tsx` | 댓글 실시간/업로드/투표/스크롤 상태가 한 컴포넌트에 몰려 회귀 위험 증가 | hook과 순수 렌더 컴포넌트로 단계적 분리 |

## 현재 조치 상태

- P0 마인크래프트 인증 우회: 코드 반영
  - `POST /api/minecraft/verify`에 `Authorization: Bearer <MINECRAFT_VERIFY_SECRET>` 검증 추가
  - secret 미설정 시 `503 minecraft_verify_not_configured`
  - secret 누락/불일치 시 `401 unauthorized`
  - 배포 전 점검 스크립트와 환경 예시에 `MINECRAFT_VERIFY_SECRET` 추가
- P1 댓글 전체 로드 경로: 코드 반영
  - `GET /api/posts/[id]/comments` 기본 호출도 root 댓글 limit 기반 페이지네이션만 수행
  - 댓글 UI의 재동기화 호출도 limit을 명시해 전체 로드 경로로 빠지지 않도록 수정
- P1 피드/사이드바 집계 비용 증가 가능: 일부 코드 반영
  - 피드 사용자 overlay 좋아요/읽음/구독 조회를 병렬화
  - 사이드바 구독 글 조회를 relation 조건 + DB 정렬/limit으로 이동
  - 사이드바 unread count를 글별 count N회에서 `groupBy` 1회로 축소
- P1 모달 접근성 골격 부재: 코드 반영
  - 공통 Modal에 `role="dialog"`, `aria-modal`, 제목 label 연결, focus trap, 포커스 복귀 추가

## 후속 권장 순서

1. P1 댓글 권한 stale JWT 제거
2. P1 업로드 rate limit/quota 추가
3. P1 댓글 pagination 강제
4. P1 GitHub Actions schedule 복구
5. P1 공통 Modal 접근성 개선
