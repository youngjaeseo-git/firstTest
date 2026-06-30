# 📑 문서 인덱스 (DC Express — DCIM)

> 이 한 장만 보고 **필요한 문서를 골라서** 보면 된다. 35개 문서를 다 열 필요 없다.
> ⭐ = 단일 권위(single source of truth) / 가장 먼저 볼 문서

---

## 🚀 처음 보는 사람 / 빠른 시작
| 무엇이 궁금하면 | 문서 | 내용 |
|----------------|------|------|
| 프로젝트가 뭔지 | [`/README.md`](../README.md) | 전체 소개·기술스택·시작점 |
| ⭐ 전체 한눈에 | [`project-handover.md`](project-handover.md) | 구조·인프라·기능·배포·남은일 요약 + **운영 배포구조(§3-1)** |
| ⭐ 현재 진행 현황 | [`project-status.md`](project-status.md) | 완료/미완료/결정사항 |

## 🧩 기능 / 요건
| | 문서 | 내용 |
|---|------|------|
| ⭐ 구현된 기능 전체 | [`features.md`](features.md) | 기능 목록 (구현 현황 단일 권위) |
| 요구사항 | [`REQUIREMENTS.md`](REQUIREMENTS.md) | 초기 요건 정의 |

## 🏗️ 아키텍처 / 데이터 흐름
| | 문서 | 내용 |
|---|------|------|
| 아키텍처 개요 | [`ARCHITECTURE.md`](ARCHITECTURE.md) / [`architecture.md`](architecture.md) | 시스템 구조 |
| 시각적 다이어그램 | [`architecture-diagram.html`](architecture-diagram.html) · [`data-flow-diagram.html`](data-flow-diagram.html) | 브라우저로 열어 보는 도식 |
| 화면별 데이터 출처 | [`technical-data-flow.md`](technical-data-flow.md) · [`data-source-mapping.md`](data-source-mapping.md) | 어느 화면이 어느 데이터를 쓰는지 |

## ⚙️ 운영 / 배포
| | 문서 | 내용 |
|---|------|------|
| ⭐ 배포·기동 절차 | [`dcim_system_usage.md`](dcim_system_usage.md) | 서버 운영 가이드 |
| 명령어 모음 | [`cmd_usage.md`](cmd_usage.md) | 자주 쓰는 명령 |
| 설치/환경 설정 | [`runtime-install-guide-20260413.md`](runtime-install-guide-20260413.md) · [`office-setup-guide-20260413.md`](office-setup-guide-20260413.md) · [`setup-troubleshooting-20260413.md`](setup-troubleshooting-20260413.md) | 폐쇄망 설치 |

## 🚨 장애 대응 / 트러블슈팅
| | 문서 | 내용 |
|---|------|------|
| ⭐ 장애 시나리오·복구 | [`failure-scenarios.md`](failure-scenarios.md) | 장애별 대응법 (DB 등) |
| 트러블슈팅 이력 | [`troubleshooting.md`](troubleshooting.md) | 해결한 문제 기록 |
| Prometheus/node-exporter | [`prometheus-issue-summary.md`](prometheus-issue-summary.md) · [`node-exporter-hang-issue.md`](node-exporter-hang-issue.md) | 메트릭 수집 이슈 |

## 🖥️ 인프라 / 시스템 정보
| | 문서 | 내용 |
|---|------|------|
| ⭐ 인프라 정보 | [`infrastructure.md`](infrastructure.md) | Prometheus·네트워크·서버 목록·hostname↔IP |
| 시스템 정보 | [`system_info.md`](system_info.md) | 환경 요약 |

## 👤 사용자
| | 문서 | 내용 |
|---|------|------|
| 사용자 매뉴얼 | [`user-manual.md`](user-manual.md) · `DC_Express_User_Manual.pptx` | 화면별 사용법 |

## 📊 보고 / 회고 (산출물)
| | 문서 | 내용 |
|---|------|------|
| 결과 보고서 | [`final-report.md`](final-report.md) · [`final-report-plan.md`](final-report-plan.md) | 프로젝트 결과 |
| 진행 보고 | [`monthly-progress.md`](monthly-progress.md) · `weekly-report-*.md` | 월간/주간 |
| 회고 | [`retrospective-prep.md`](retrospective-prep.md) · [`retrospective-summary.md`](retrospective-summary.md) · `retrospective-presentation.pptx` | 바이브 코딩 회고 |

## 🛠️ 개발 규칙 / 이력
| | 문서 | 내용 |
|---|------|------|
| ⭐ 프로젝트 규칙 | [`/CLAUDE.md`](../CLAUDE.md) | 작업 규칙(팀A/B, Data-First, 검증 등) |
| 코드 작성 규칙 | [`/rules.md`](../rules.md) | 코드/스크립트 컨벤션 |
| 작업 로그 | [`work-log.md`](work-log.md) | 시간순 작업 이력 |
| 세션 인계 | [`handoff-20260629.md`](handoff-20260629.md) | 세션 인수인계 |
| 버그/TODO | [`bugs-rev0.md`](bugs-rev0.md) · [`TODO-cleanup.md`](TODO-cleanup.md) · [`/todo.md`](../todo.md) | 미해결 목록 |
| 변경 이력 | [`/CHANGELOG.md`](../CHANGELOG.md) | 버전별 변경 |

## 🔍 외부 데이터 확인 스크립트 (개발자용)
| 폴더 | 내용 |
|------|------|
| `check/targetExecCmd/` | 날짜별 확인 스크립트 (Prometheus/DB/도커 진단 등) |
| `check/results/` | 확인 결과 영구 저장 (폐쇄망: 한 번 받은 데이터 재요청 안 함) |

---

> 💡 **이 인덱스가 오래되면** 새 문서 추가/삭제 시 여기도 같이 갱신할 것.
