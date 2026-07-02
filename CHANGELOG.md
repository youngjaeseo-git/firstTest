# 변경 이력 (Changelog)

DC Express — DCIM. 날짜는 YYYY-MM-DD.

---

## [Unreleased]

UML 다이어그램 작성 중 발견한 권한/보안 허점(S1~S19) 조치. 근거·전체 목록: `docs/uml-diagrams.md §5`.

### [보안] 권한 우회 수정
- **[S1] 평가·워크로드 쓰기 API 역할 가드 추가**: `evaluations`(프로젝트·phases·tasks·notes·results)와 `workloads/[namespace]`의 모든 쓰기(POST/PATCH/DELETE)에 `canEdit` 가드 추가(프로젝트 삭제는 `canDelete`). 이전엔 로그인만 하면 VIEWER도 생성/수정/삭제 가능했음.
- **[S2] 장비 할당 역할 가드 추가**: `equipment/[id]/assignments` POST·PATCH에 `canEdit` 추가(기존 org 검사와 병행). VIEWER가 org 내 할당을 변경하던 우회 차단.
- **[S4] 메트릭 프록시 경량 하드닝**: `metrics/range` 조회 창(duration) 7일 상한, `instant`·`range` PromQL 길이 2000자 상한, 응답 `Cache-Control: public`→`private`(S17 동시 해결). 무제한 range로 인한 Prometheus DoS·공유 캐시 노출 방지.
- **[S5] cron 인증 강화**: `?key=` 쿼리 파라미터 수용 제거(로그 노출 방지), Bearer 헤더만 허용, 비교를 `timingSafeEqual`(상수시간)로 변경. 공통 헬퍼 `src/lib/cron-auth.ts`로 alert-check·expiry-check 통일.

### v1.0 이월 (설계 허점 후속)
- **[S3] 알림 org 필터**: `Alert`·`AlertRule` 모델에 organizationId가 없어 조직별 필터 불가 → 스키마 마이그레이션(+ `source`→equipment 매핑) 필요. 폐쇄망 `prisma db push` 동반이라 v1.0에서 처리.
- **[S4-심화] 서버측 PromQL 화이트리스트**: 팀A/B 토론 결과, 프론트 13개 호출부를 `queryId+params` 방식으로 옮기는 전면 리팩터(1~2일)라 방어심화 항목으로 이월. 프론트에 자유형 PromQL 입력 UI가 없어(사실상 화이트리스트) 현행 캡으로 실질 위험은 차단됨.
- **[S6~S16, S18~S19]** 권한 비대칭·알림 엔진 관측성·감사로그 write 실패 처리 등 → `docs/uml-diagrams.md §5` 참조.

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
