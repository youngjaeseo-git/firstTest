# DCIM 프로젝트 작업 일지

---

## 2026-04-10 (목)
### 완료
- 장비 일괄 등록 기능 추가 (CSV 업로드, 미리보기, 유효성 검증)

---

## 2026-04-11 (금)
### 완료
- Phase 1 Observability 메트릭 추가 (Load Avg, IOPS, Latency, Network errors)
- 서버 비교 뷰 및 CPU 코어 히트맵 추가
- UI 전반 개선 (애니메이션, glassmorphism, UX 향상)
- 글로벌 커맨드 팔레트 (⌘K) 및 Twin view 브레드크럼 추가
- NextAuth 인증 설정 수정 (NEXTAUTH_SECRET)

---

## 2026-04-12 (토)
### 완료
- Prometheus fetch timeout 3초로 단축
- dev.sh 스타트업 스크립트 추가
- 알림 벨 드롭다운 z-index 및 대시보드 로딩 플래시 수정
- Vitest + Playwright 테스트 인프라 구축
- SSE 스트림 방식 대시보드 메트릭 (폴링 대체)
- 한국어/영어 i18n 및 언어 전환기 추가
- Prometheus 상태 인디케이터 및 대시보드 에러 바운더리
- Redfish 전원 제어, BMC 콘솔 링크, 장비 히스토리
- 아키텍처 문서 정리 (todo.md 백로그, 다이어그램)

---

## 2026-04-13 (일)
### 완료
- 사내 배포 가이드 작성 (office-setup-guide, runtime-install-guide, troubleshooting)
- .env.example 사내 환경 값 반영
- 개발자 환경 섹션 CLAUDE.md 추가
- 멀티 Prometheus 백로그 문서화 (Lab1/Lab3)

---

## 2026-04-14 (월)
### 완료
- Prisma binaryTargets 크로스 플랫폼 설정 (`debian-openssl-3.0.x`, `debian-openssl-1.1.x`)
- Mac → GitHub → 사무실 PC → NFS → 리눅스 서버 파일 전송 파이프라인 확립

---

## 2026-04-17 (목)
### 완료
- 리눅스 서버 배포 성공 (PostgreSQL 5433, 앱 3000)
- server-start.sh 편의 스크립트 작성
- Prometheus 연결 확인 (K8s ClusterIP `10.100.175.248:8080` / NodePort `10.144.38.100:30003`)
- Prometheus job 필터 수정 (node-exporter → 실제 서비스 기반 exclusion 필터)
- 메트릭 시스템 전환: node-exporter → Intel PCM → **cAdvisor** (최종 확정)
- 대시보드 fleet 쿼리 cAdvisor 변환 완료

### 확인된 사항
- 온도 데이터는 Prometheus가 아닌 외부 SQL DB에 있음 (Grafana PDU monitoring 패널)
- cAdvisor 메트릭: `container_*`, `machine_*` 계열 사용
- 노드 UP 174대 / DOWN 204대 확인

---

## 2026-04-20 (일)
### 완료
- Per-server 메트릭 쿼리 전체 cAdvisor 변환 (CPU, Memory, Disk, Network, Power 등)
- 시드 데이터 삭제 API 생성 (`POST /api/admin/cleanup-seed`)
- Prometheus Discovery 페이지 전면 재작성
  - 타겟 목록 표시 (Job/Health/Linked 필터)
  - 타겟 → 장비 등록 기능 (Register 버튼)
- `GET /api/discovery/targets` 엔드포인트 생성
- `POST /api/discovery/register` 엔드포인트 생성
- Discovery sync API 응답 포맷 수정 (프론트엔드와 필드명 일치)
- 전체 변경사항 커밋 및 push 완료 (`3d18477`)

---

## TODO (해야 할 일)

### 우선순위 높음
- [ ] 시드(가짜) 데이터 삭제 실행 — `POST /api/admin/cleanup-seed` 호출
- [ ] 실제 서버 2~3대 등록 테스트 — Discovery 페이지에서 Register
- [ ] 개별 서버 상세 메트릭 검증 — 등록 후 서버 상세 페이지 차트 확인
- [ ] 대시보드 fleet 메트릭 값 검증 — cAdvisor 쿼리 실제 데이터 확인
- [ ] 최신 코드 리눅스 서버 반영 — PC에서 git pull → NFS → 서버에서 재시작

### 우선순위 중간
- [ ] 온도 데이터 연동 — 외부 SQL DB 연결 구현 (Grafana의 PDU monitoring 데이터소스)
- [ ] CLAUDE.md의 Prometheus URL 수정 (`10.144.38.100:30004` → 실제 값)
- [ ] 서버 상세 페이지에서 실시간 메트릭 WebSocket 연동 확인

### 우선순위 낮음
- [ ] 멀티 Prometheus 지원 (Lab1/Lab3 등 여러 클러스터)
- [ ] 장비 등록 시 Rack/U position 자동 할당 로직
- [ ] PDF 리포트 내보내기 기능
- [ ] E2E 테스트 시나리오 작성 (Discovery → Register → Monitor 플로우)
