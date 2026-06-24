# DCIM 기능 목록

> 2026-06-24 기준 구현 상태

---

## 1. 대시보드 (Dashboard)

| 기능 | 상태 | 설명 |
|------|------|------|
| 서버 가동 현황 | ✅ 완료 | Prometheus UP/DOWN 집계, 전체 서버 수 표시 |
| 평균 CPU/Memory 사용률 | ✅ 완료 | node-exporter 우선, cAdvisor 폴백 |
| 총 전력 소비량 | ✅ 완료 | Intel PCM Package_Joules_Consumed 합산 |
| 네트워크 트래픽 요약 | ✅ 완료 | 인바운드/아웃바운드 합산 |
| Fleet Top 5 CPU/Memory | ✅ 완료 | NE+cAdvisor dedup, hostname 표시, IP↔hostname 중복 제거(node_uname_info 기반) |
| Lab-1/Lab-3 클러스터 필터 | ✅ 완료 | All/Lab-1/Lab-3 탭으로 메트릭 분리 |
| Trend Sparkline | ✅ 완료 | CPU/Memory/Network/Power 추이 그래프 |
| Platform 분포 | ✅ 완료 | GNR-AP/GNR-SP/SPR/Ampere/SRF별 장비 수 |
| 만료 임박 위젯 | ✅ 완료 | ExpiryTracker 기반 D-day 표시 |
| 알림 심각도별 위젯 | ✅ 완료 | 심각도별 현재 firing 수(주) + 24h 발생 수(보조) 타일 |
| PUE 위젯 | ✅ 완료 | PUE 게이지 아크 + 효율 등급 + 24h 추이 스파크라인 |
| Prometheus 연결 상태 | ✅ 완료 | 연결 성공/실패 인디케이터 |
| 에러 바운더리 | ✅ 완료 | Prometheus 장애 시 UI 깨지지 않음 |

---

## 2. 서버 모니터링 (Server Monitoring)

| 기능 | 상태 | 설명 |
|------|------|------|
| 서버 목록 (리스트/트윈 뷰) | ✅ 완료 | 호스트명, IP, 상태, Power State, 위치 표시 |
| 서버 검색/필터/정렬 | ✅ 완료 | Model/Status/Room 콤보박스 + 컬럼 정렬 |
| Power State 표시 | ✅ 완료 | Running/Idle/OFF 실시간 배지 (Prometheus up + CPU 기반) |
| CPU 사용률 차트 | ✅ 완료 | 실시간 라인차트 (15m/1h/6h/24h/7d) |
| CPU Load + Cores 기준선 | ✅ 완료 | 코어 수 시리즈 추가로 load 대비 비교 |
| CPU Mode 분석 | ✅ 완료 | User / System 모드 비율 |
| CPU 코어 히트맵 | ✅ 완료 | 코어별 실제 사용률 시각화 |
| 메모리 사용률 차트 | ✅ 완료 | 사용률 % + 절대값 (Used/Cache) |
| 메모리 요약 섹션 | ✅ 완료 | 슬롯 다이어그램 + 용량/타입/제조사 카드 |
| 디스크 I/O | ✅ 완료 | 읽기/쓰기 처리량, IOPS, 지연시간 |
| 디스크 사용률 | ✅ 완료 | 호스트 디스크 (/dev/mapper) 사용 % |
| 네트워크 대역폭/에러 | ✅ 완료 | RX/TX, 에러/드롭, TCP 연결 |
| 전력 소비 차트 | ✅ 완료 | Intel PCM + PP0 (프로세서 패키지) |
| PCM 고급 메트릭 | ✅ 완료 | IPC, 캐시 적중률, DRAM 대역폭 |
| Node Resources 카드 | ✅ 완료 | kube-state-metrics CPU/Memory/Disk 게이지 |
| Pod 목록 | ✅ 완료 | kube_pod_info 기반 Pod 이름/namespace |
| BMC 센서 모니터링 | ✅ 완료 | Redfish 온도/팬/전력 센서 카드 |
| 서버 비교 뷰 | ✅ 완료 | 2대 이상 서버 메트릭 병렬 시계열 오버레이 (최대 4대) |
| 메트릭 없는 서버 안내 | ✅ 완료 | Prometheus 시계열이 전혀 없으면 빈 차트 대신 안내 배너 표시 |
| Hostname↔IP 통합 resolver | ✅ 완료 | 3곳에 분산된 hostname↔IP 매핑을 `hostname-resolver.ts` 단일 모듈로 통합. DB + Prometheus node_uname_info 폴백 지원 |
| 메트릭 중복 제거 | ✅ 완료 | Temperature+IPMI Temperature 2개 차트를 1개로 병합, CFS Throttled 쿼리 버그 수정 (cpuModeIowait→cfsThrottled), 서버비교 포트 불일치 수정 |

---

## 3. 인프라 관리 (Infrastructure Management)

| 기능 | 상태 | 설명 |
|------|------|------|
| 장비 목록/검색 | ✅ 완료 | 전체 장비 테이블 + 페이지네이션 |
| 플랫폼별 필터/검색 | ✅ 완료 | model→platform 자동 매핑(SPR/GNR/SRF 등), 플랫폼 필터 칩 + 텍스트 검색. Platform·Model·U 컬럼 추가 |
| 장비 CRUD | ✅ 완료 | 등록/수정/삭제 + 라이프사이클 관리 |
| CSV 대량 등록 | ✅ 완료 | CSV 업로드 → 미리보기 → 유효성 검증 |
| BMC HW 자동 수집 | ✅ 완료 | Redfish로 CPU/Memory/NIC 자동 감지 |
| 메모리 상세 페이지 | ✅ 완료 | DIMM 슬롯별 용량/타입/제조사/속도/채널 |
| 메모리 전체 현황 | ✅ 완료 | /memory 페이지 — 서버별 DIMM 집계 |
| 변경 이력 (타임라인) | ✅ 완료 | 장비별 수정/전원/상태/유지보수 이력 타임라인 (equipment-history) |
| 펌웨어 관리 | ✅ 완료 | /firmware — 서버 모델별 BIOS/펌웨어 버전 비교, 오래된 버전 식별 |
| Redfish 전원 제어 | ✅ 완료 | BMC를 통한 원격 켜기/끄기/재시작 |

---

## 4. 랙 관리 (Rack Management)

| 기능 | 상태 | 설명 |
|------|------|------|
| 랙 시각화 | ✅ 완료 | 물리적 랙 배치도 + U 위치별 장비 표시 |
| 온도 히트맵 | ✅ 완료 | 장비별 온도 색상 표시 (ON/OFF 토글) |
| 드래그&드롭 배치 | ✅ 완료 | 미배치 장비를 랙 슬롯에 드래그 |
| Room/Rack CRUD | ✅ 완료 | /racks/manage에서 Room·Rack 생성/수정/삭제 |
| sortOrder 관리 | ✅ 완료 | Room·Rack 표시 순서 수동 지정 |
| 일괄 배치 | ✅ 완료 | BulkPlacePanel로 다수 장비 일괄 배치 |

---

## 5. Prometheus Discovery (자동 탐지)

| 기능 | 상태 | 설명 |
|------|------|------|
| 타겟 동기화 | ✅ 완료 | Prometheus /api/v1/targets에서 자동 수집 |
| 타겟 필터/검색/페이지네이션 | ✅ 완료 | Job/Health/등록여부 필터 + 50개 단위 |
| 장비 등록/해제 | ✅ 완료 | 타겟→장비 자동 생성 (CPU/메모리 감지) |
| Prometheus 설정 진단 | ✅ 완료 | IP-only/중복스크래핑/orphan 탐지 페이지 |

---

## 6. Digital Twin (물리적 탐색 뷰)

| 기능 | 상태 | 설명 |
|------|------|------|
| 데이터센터 평면도 | ✅ 완료 | Lab-1/Lab-2/Lab-3 물리적 위치 관계를 SVG 지도로 표시, 방별 장비수/사용률 오버레이. 와이드 레이아웃(1400x650) + 인프라 요소(냉각기·PDU·네트워크 스위치·DCIM 마커) 표시 |
| 평면도 줌/팬 | ✅ 완료 | 마우스 휠 줌(0.5~4x), 클릭+드래그 팬, 줌 컨트롤 버튼(+/-/리셋) |
| Room 레이아웃 | ✅ 완료 | Room → Rack 그룹 시각화 (SVG) |
| Rack Elevation | ✅ 완료 | 랙 내부 U 위치별 장비 배치도 |
| 장비 팝오버 | ✅ 완료 | 장비 클릭 시 상세 정보 표시 |
| 브레드크럼 내비게이션 | ✅ 완료 | Room → Rack → Equipment 단계별 탐색 |
| 디지털 트윈 사이드바 메뉴 | ✅ 완료 | 좌측 사이드바 독립 메뉴(/digital-twin)로 접근. /servers 토글도 유지 |
| 평면도 랙 배치 편집 (어드민) | ✅ 완료 | 편집 모드 토글 → 랙 드래그로 위치 변경 → PATCH API로 positionX/Y 저장. 방 경계 내 제한, 줌 상태에서도 정확한 좌표 변환 |
| 평면도 인프라 요소 배치 (어드민) | ✅ 완료 | RoomElement 테이블로 냉각기·PDU·스위치·마스터서버 관리. 편집 모드에서 드래그 배치, CRUD API(RBAC/감사), 에어플로우 방향·길이는 metadata JSON으로 저장 |
| 평면도 온도 히트맵 오버레이 | ✅ 완료 | Temp 버튼 토글 → Prometheus hwmon 온도 30초 폴링 → 랙별 평균 온도 색상 오버레이(녹→적 6단계). 범례 표시 |
| 평면도 용량(U) 오버레이 | ✅ 완료 | Capacity 버튼 토글 → 랙별 U 사용률(%) 색상 오버레이. 60%/85% 임계값 3단계 |
| 평면도 랙 호버 툴팁 | ✅ 완료 | 랙 위 마우스 호버 시 SVG 툴팁: 이름, 서버 수, U 사용률(%), 온도(°C) 표시 |
| 방 지오메트리 DB화 | ✅ 완료 | Room 모델에 layoutX/Y/W/H 추가. DB 값 있으면 DB 좌표 사용, 없으면 하드코딩 폴백. PATCH API·Zod 스키마 지원 |
| 에어플로우 방향 토글 | ✅ 완료 | 편집 모드에서 냉각기 우클릭 → 에어플로우 방향(up↔down) 전환. metadata JSON으로 즉시 PATCH |
| 문(DOOR) 요소 | ✅ 완료 | RoomElement DOOR 타입 지원. 건물 전체 범위 드래그 이동, 우클릭으로 방향 전환(가로↔세로) |
| 요소 추가/삭제 UI | ✅ 완료 | 편집 모드에서 방별 "+" 버튼으로 요소 추가(COOLING/PDU/SWITCH/MASTER_SERVER/DOOR). 요소 위 "×" 버튼으로 삭제. POST/DELETE API 연동 |
| 요소/랙 드래그 리사이즈 | ✅ 완료 | 편집 모드에서 좌클릭 드래그=크기 조절(width/height), 우클릭 드래그=위치 이동, 우클릭 탭=방향 전환. 랙·인프라 요소 모두 지원. PATCH API로 즉시 저장 |
| 방(Room) 드래그 리사이즈 | ✅ 완료 | 편집 모드에서 방 우하단 핸들로 좌클릭 드래그=크기 조절(min 100x80), 방 영역 우클릭 드래그=위치 이동. layoutX/Y/W/H를 PATCH API로 즉시 저장 |
| 크기 통일 컨텍스트 메뉴 | ✅ 완료 | 편집 모드에서 랙/냉방기/PDU 등 우클릭 탭 → "이 크기로 통일" 메뉴. 같은 방 내 동일 타입 요소에 width/height 일괄 적용. 냉방기/문은 "방향 전환" 메뉴도 포함 |
| 다중 선택 정렬 (가로/세로) | ✅ 완료 | 편집 모드에서 랙/요소를 좌클릭으로 다중 선택(파란색 하이라이트), 2개 이상 선택 시 툴바에 "가로 정렬"(같은 Y) / "세로 정렬"(같은 X) 버튼 표시. 선택 항목의 평균 좌표로 일괄 정렬 후 PATCH 저장. 빈 영역 클릭으로 선택 해제 |
| 랙 호버 리치 팝오버 | ✅ 완료 | 랙에 마우스 호버 시 HTML 오버레이로 상세 정보 표시: 서버 수(활성/장애), U 사용률(프로그레스바), 평균 온도, 서버 호스트명 목록. SVG 텍스트 대신 shadcn 카드 스타일 |
| 랙 클릭→랙 상세 이동 | ✅ 완료 | 비편집 모드에서 랙 클릭 시 /racks?highlight=RACK_ID로 이동. 해당 랙 자동 펼침 + 스크롤 + 하이라이트 테두리 |

---

## 7. 워크로드 (Workloads)

| 기능 | 상태 | 설명 |
|------|------|------|
| Active 탭 | ✅ 완료 | Prometheus 실시간 Pod 상태 (namespace별 그룹), Lab-1/Lab-3 듀얼 Prometheus 지원 (대시보드 + /workloads + 상세 페이지) |
| 종료된 워크로드 | ✅ 완료 | DB에 기록된 과거 namespace를 Active 탭 하단 표시 |
| History 탭 | ✅ 완료 | 프로젝트 달력 타임라인 시각화 |
| Pod Health | ✅ 완료 | Running/Pending/Warning/Error/Completed 상태 |
| 클러스터 필터 | ✅ 완료 | All/Lab-1/Lab-3 필터로 워크로드 목록+상세 페이지에서 클러스터별 Pod 조회 |

---

## 8. 알림 관리 (Alert Management)

| 기능 | 상태 | 설명 |
|------|------|------|
| 활성 알림 목록 | ✅ 완료 | 현재 발생 중인 알림 표시 |
| 알림 이력 | ✅ 완료 | 날짜별 접기/펼치기 그룹 |
| 알림 규칙 관리 | ✅ 완료 | 규칙 생성/수정/삭제 + zod 검증 |
| 알림 확인 (Acknowledge) | ✅ 완료 | 담당자 확인 처리 |
| 알림 수신 채널 | ✅ 완료 | /alerts/settings — Email/Slack/Teams/Webhook 채널 CRUD + 테스트 발송 (관리자) |
| 알림 에스컬레이션 정책 | ✅ 완료 | 심각도별 N분 미확인 시 채널 통지 정책 CRUD (관리자). 평가 엔진은 향후 연동 |
| 유지보수 창 (알림 억제) | ✅ 완료 | 기간/범위(전체·source·category)별 알림 음소거. 활성 창은 알림 목록 음소거 배지 + 헤더 벨 카운트에서 제외 |

---

## 9. 설정 (Settings)

| 기능 | 상태 | 설명 |
|------|------|------|
| 사용자 관리 | ✅ 완료 | RBAC (Admin/Operator/Viewer) |
| BMC IP 매핑 | ✅ 완료 | 장비별 BMC IP 인라인 편집 + 자동 유도 |
| BMC 자격증명 관리 | ✅ 완료 | 장비별 BMC 계정 오버라이드 |
| BMC 프록시 (멀티사이트) | ✅ 완료 | Room별 bmcProxyUrl 설정 → 원격 BMC 접근 (Lab-3 등) |
| Prometheus 진단 | ✅ 완료 | IP-only/중복/orphan 진단 페이지 |
| 만료 추적 | ✅ 완료 | 인증서/라이선스/보증 만료일 관리 |
| 감사 로그 조회 (/history) | ✅ 완료 | 액션/엔티티/사용자/날짜 필터 + 필드 diff 표시 |
| 서버 사용 현황 (Assignments) | ✅ 완료 | 장비별 사용자 할당/반납 + 이력 추적, /assignments 전체 현황 페이지 |
| 감사 로그 적용 범위 | ✅ 완료 | equipment·rack·room·user·alert-rule·discovery·assignment CRUD 전반 logAudit |
| Audit Log Export | ✅ 완료 | CSV 내보내기 (날짜 필터 + 이스케이프) |
| 가입 승인 시스템 | ✅ 완료 | 공개 회원가입 시 approved=false, 관리자 승인 후 로그인 가능. 관리 페이지에서 승인/거부 처리 |

---

## 10. 운영 자동화 (Operations)

| 기능 | 상태 | 설명 |
|------|------|------|
| DB 백업 자동화 | ✅ 완료 | pg_dump + cron (매일 03:00, 7일 보관) |
| 로그 로테이션 | ✅ 완료 | logrotate + cron (매일 04:00, 50MB 제한) |
| 장애 복구 도구 | ✅ 완료 | 대화형 메뉴 (진단/재시작/백업복원) |
| 배포 파이프라인 | ✅ 완료 | 자동 백업 + git pull + migrate + 헬스체크 |

---

## 11. 용량 계획 / 리포트 (Capacity / Reports)

| 기능 | 상태 | 설명 |
|------|------|------|
| 용량 현황 (Capacity) | ✅ 완료 | /capacity — 전력/공간/냉각/컴퓨팅 용량 현황 표시 |
| 용량 예측 (Forecast) | ✅ 완료 | 장비 createdAt 기반 월별 성장 추이 차트 + 선형회귀 12개월 전망 + 랙공간/전력 소진일 예측 카드 |
| 리포트 뷰 (Reports) | ✅ 완료 | /reports — 인프라 현황 + 알림 통계 리포트 (생성시각 포함) |
| 리포트 PDF 내보내기 | ✅ 완료 | 네이티브 PDF 다운로드 (html2canvas+jsPDF, A4 페이지네이션, 한글 지원) + 브라우저 인쇄 |

---

## 12. 기타

| 기능 | 상태 | 설명 |
|------|------|------|
| 글로벌 검색 (Cmd+K) | ✅ 완료 | 서버/장비 통합 검색 + 랙 배치 바로가기 |
| 한국어/영어 전환 | ✅ 완료 | i18n 다국어 지원 |
| 다크/라이트 모드 토글 | ✅ 완료 | 헤더 토글. gray 스케일을 CSS 변수로 반전 → 전 페이지 자동 적용. localStorage 저장 + 무플래시 초기화 |
| API zod 검증 | ✅ 완료 | 전체 20+ 라우트 입력 검증 |
| BMC 콘솔 링크 | ✅ 완료 | BMC 웹 UI 새 탭 열기 |
| 사용자 매뉴얼 | ✅ 완료 | 코드 기반 사용자 매뉴얼 (`docs/user-manual.md`). 대시보드, 서버 모니터링, 랙 뷰, 디지털 트윈, BMC/Redfish, K8s 연동, 워크로드 관리 7개 섹션 |

---

## 미구현 / 예정

| 기능 | 상태 | 설명 |
|------|------|------|
| UI/디자인 개선 — PageHeader 통일 | ✅ 완료 | 17개 페이지의 raw h1 태그를 PageHeader 컴포넌트로 교체. 아이콘+그라데이션 배경+액센트 색상 통일 |
| UI/디자인 개선 — Button 표준화 | ✅ 완료 | evaluations, discovery, prometheus-diagnostic, organizations 페이지의 raw button→shadcn Button 컴포넌트 교체 (19개 버튼) |
| UI/디자인 개선 — inputClass 추출 | ✅ 완료 | 5개 페이지에 중복된 inputClass/labelClass를 `src/lib/styles.ts` 공유 모듈로 추출 |
| UI/디자인 개선 — 테이블 패딩 표준화 | ✅ 완료 | firmware, reports, search, bmc 4개 페이지의 테이블 th/td 패딩을 `px-3 py-2` + `divide-y divide-gray-800` 표준 패턴으로 통일 |
| Multi-Prometheus | ✅ 완료 | Lab-3 Prometheus(10.144.131.190:30003) 듀얼 조회. instantQueryFrom() + source=lab3 API 파라미터. 대시보드 Active Workloads에서 Lab-3 Pod 표시. Lab-3 장애 시 경고 배너 표시 (대시보드 + 워크로드) |
| 온도 외부 DB 연동 | 📋 보류 | Grafana에 ddr4_temp CSV + 다수 PostgreSQL 존재. 구체적 요건 미확인 |
| DB 컨테이너 이름 변경 | ✅ 완료 | docker-compose container_name: dcim-db / dcim-app 명시 |
| systemd 서비스 등록 | ✅ 완료 | `scripts/setup-service.sh --install`로 서비스 등록. dev/prod 모드 전환, 부팅 시 자동 시작, `systemctl restart dcim`으로 코드 반영 |
| 프로덕션 빌드 | 📋 예정 | npm run build + start 전환 |
| DRAM 인증 테스트 관리 | 📋 예정 | 파트넘 기반 테스트 계획/추적 |
| 워크로드 스텝 정보 | 📋 예정 | YAML 파싱 기반 실행 단계 표시 |
| 로고 디자인 확정 | ✅ 완료 | SK hynix 브랜딩 로고 적용 (사이드바/로그인/회원가입). DRAM AE 워드마크 + 글로우 링 + 3x3 셀 그리드 |
| 조직별 접근 제어 | ✅ 완료 | Organization/UserOrganization 모델, Equipment.organizationId FK. ADMIN은 전체 접근, 비ADMIN은 소속 조직 장비만 조회/조작. JWT에 orgIds 캐싱. Equipment CRUD + 13개 하위 API + 검색/디스커버리에 조직 필터 적용. Admin 조직 관리 페이지 (/settings/organizations) |
| 프로젝트 회고 준비 | ✅ 완료 | 바이브 코딩 경험 공유를 위한 회고 준비 자료 (docs/retrospective-prep.md). 4주간 읽어볼 파일 목록, 타임라인, 교훈 정리 |
| 기술 데이터 흐름 문서 | ✅ 완료 | 전체 화면별 데이터 소스 매핑 문서 (docs/technical-data-flow.md) + 인터랙티브 다이어그램 (docs/data-flow-diagram.html). Prometheus/PostgreSQL/BMC/K8s 연동 상세 |
| 결과보고서 | ✅ 완료 | 프로젝트 최종 보고서 본문 작성 (docs/final-report.md). 8개 섹션 — 요약, 배경, 비포/애프터, 활용 시나리오, 아키텍처, AI 개발 경험, 성과/한계, 향후 계획 |
| 장애 시나리오 매뉴얼 | ✅ 완료 | 20개 장애 시나리오 대응 매뉴얼 (docs/failure-scenarios.md). 증상/원인/진단/복구/예방 + 에스컬레이션 가이드 + 정기 점검 체크리스트 |
| 프로젝트 진행 현황 | ✅ 완료 | 전체 진행 현황 + 미완료 + 결정 필요 사항 정리 (docs/project-status.md) |

---

## 범례

| 상태 | 의미 |
|------|------|
| ✅ 완료 | 구현 완료, 사용 가능 |
| ⚠️ 부분 | 일부 구현됨, 추가 작업 필요 |
| 📋 예정 | 미구현, 향후 계획 |
