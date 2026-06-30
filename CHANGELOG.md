# 변경 이력 (Changelog)

DC Express — DCIM. 날짜는 YYYY-MM-DD.

---

## [0.9.0] — 2026-06-30 (릴리즈 후보)

소스 확정(release candidate). 8-에이전트 버그 점검·적대적 검증 후 확정.

### 핵심 기능 (구현 완료 — 상세: `docs/features.md`)
- **대시보드**: 인프라 요약, 서버 현황, 전력/PUE, 알림 위젯, 파일시스템 경고
- **서버 모니터링**: CPU/메모리/디스크/네트워크/온도/전력/PCIe, BMC 센서, K8s Pod, 서버 비교, 실시간(SSE)
- **메모리 상세**: DIMM 슬롯별 정보, 채널 다이어그램
- **인프라 관리**: 장비 CRUD, CSV 등록, 펌웨어, BMC 전원 제어, 라이프사이클, Bulk HW Refresh
- **Digital Twin / 랙**: 평면도, 줌·팬, 편집, 랙 배치도·열지도, 드래그&드롭
- **알림**: 규칙 평가 엔진(5분 cron), 이력, 채널/에스컬레이션, 유지보수 창
- **설정**: RBAC, 조직별 접근 제어, 감사 로그
- **용량/리포트**: 용량 현황, 12개월 예측, 리포트 출력
- **운영 자동화**: DB 백업, 로그 로테이션, systemd 프로덕션 빌드
- **기타**: Cmd+K 검색, i18n(한/영), 다크모드

### 인프라 연동
- Prometheus auto-discovery, node-exporter 우선 + cAdvisor 폴백
- **Lab-3 node-exporter 호스트 파일시스템 노출** (hostPath:/ + `--path.rootfs`, NFS 포함)
- 다중 클러스터(Lab-1/Lab-3) 필터

### 이번 사이클 주요 수정 (보안·정확성)
- **[보안] 조직 접근 정책 통일**: 모든 장비 하위 라우트(status/history/power/memory/refresh-hw/assignments/sensors)에서 org 미배정(null) 장비를 비-ADMIN에게 차단. 이전엔 power/memory가 느슨한 검사로 **비소속 OPERATOR가 전원 리셋/DIMM 변조 가능**한 우회 존재 → 수정.
- **[보안] POST 장비 생성 org 검증**: 비-ADMIN은 소속 조직만 지정 가능.
- **대시보드 파일시스템 경고**: hostname 표시 + 깨진 링크(/servers/{id}) 수정, **중복 표시 제거**(서버 단위 dedup, IP+hostname 키). job 필터 과다로 실서버를 숨기던 회귀 수정.
- **NodeOverview CPU**: load average를 사용률%로 오표시하던 것 → 실제 cpuUsage 기반 사용 코어/%로 정정.
- **알림 엔진**: ACKNOWLEDGED 알림 중복 생성·미해소 수정, Prometheus 빈응답 시 잘못된 일괄 해소(플랩) 방지, `=` 연산자 허용.
- **알림 이력 날짜 필터**: 현재 페이지만 거르던 것 → 서버 사이드 필터로 총계·페이지네이션 정합.
- **refresh-hw**: Int 컬럼에 소수 메모리값 → 반올림(Prisma 에러 방지). 장비 DELETE 404 처리.
- **[크래시] 용량 관리·리포트 화면 복구**: 서버 컴포넌트가 클라이언트 헤더(TranslatedPageHeader)에 아이콘 *함수*를 넘겨 RSC 직렬화 에러("Functions cannot be passed directly to Client Components")로 두 화면이 통째로 죽던 문제 → 아이콘을 이름(문자열)으로 전달하도록 수정. (부수: reports groupBy 정합, capacity DB오류 방어 추가)
- 다수 데드코드·i18n 누락 키·문서 정합성 수정.

### 문서 (산출물)
- **README.md** 신규(실제 프로젝트 소개·배포 구조).
- **docs/INDEX.md** 신규(문서 안내 지도).
- **docs/project-handover.md §3-1**: 실제 운영 배포 구조 명문화(앱=systemd, DB=docker 5433).

### ⚠️ 알려진 이슈 (다음 버전 대상)
- **MetricChart 다중 시계열**: 한 쿼리가 여러 시계열을 반환하면 같은 라벨로 덮어써 **하나만 표시**됨. 차트 쿼리는 집계(sum/avg) 형태 사용 권장. 동적 다중 라인 렌더는 후속.
- **랙 위치 충돌 검증**: 단건 POST 생성·CSV bulk 생성 시 U위치 중첩/용량 검증이 PUT/bulk-place와 달리 누락. (이미 배치된 U에 겹쳐 등록 가능)
- **알림 규칙 duration('for' 윈도우)**: 수집·표시는 되나 평가 엔진이 미사용 — 조건 1회 충족 시 즉시 발화(지속시간 미반영).
- **Lab-3 cAdvisor**: 비기능(인프라팀 ConfigMap 영역). node-exporter는 통합 완료.

### 운영 메모
- 운영 = **systemd 앱 + Docker DB(5433)** 하이브리드. `docker compose up -d app` 금지(상세: README / project-handover §3-1).
- 알림 cron 동작에 `.env`의 `CRON_SECRET` 필요 → `systemctl restart dcim`로 반영.
