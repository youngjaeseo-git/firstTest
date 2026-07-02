#!/usr/bin/env python3
"""DC Express 프로젝트 회고 발표 PowerPoint 생성 스크립트"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

# === Color Palette (Light Theme — 기존 매뉴얼 PPT와 동일) ===
SLIDE_BG = RGBColor(0xFF, 0xFF, 0xFF)
ACCENT_BLUE = RGBColor(0x00, 0x70, 0xC0)
ACCENT_CYAN = RGBColor(0x00, 0xA5, 0x85)
ACCENT_PURPLE = RGBColor(0x6C, 0x2E, 0xD6)
ACCENT_ORANGE = RGBColor(0xE0, 0x8A, 0x00)
ACCENT_RED = RGBColor(0xDC, 0x2E, 0x2E)
ACCENT_GREEN = RGBColor(0x16, 0xA3, 0x4A)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
TEXT_PRIMARY = RGBColor(0x1F, 0x1F, 0x1F)
TEXT_SECONDARY = RGBColor(0x5A, 0x5A, 0x6E)
TEXT_MUTED = RGBColor(0x8C, 0x8C, 0x9A)
LIGHT_GRAY = RGBColor(0xE5, 0xE7, 0xEB)
CARD_BG = RGBColor(0xF8, 0xF9, 0xFB)
CARD_BORDER = RGBColor(0xE0, 0xE0, 0xE8)

SECTION_COLORS = [
    ACCENT_BLUE,     # 1
    ACCENT_CYAN,     # 2
    ACCENT_PURPLE,   # 3
    ACCENT_ORANGE,   # 4
    ACCENT_RED,      # 5
    ACCENT_GREEN,    # 6
    RGBColor(0x06, 0xB6, 0xD4),  # 7
    RGBColor(0x8B, 0x5C, 0xF6),  # 8
    RGBColor(0xEC, 0x48, 0x99),  # 9
    RGBColor(0x14, 0xB8, 0xA6),  # 10
]

current_section_idx = 0

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


def set_slide_bg(slide, color=SLIDE_BG):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_shape(slide, left, top, width, height, fill_color=None, border_color=None, border_width=Pt(0)):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.background()
    if fill_color:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill_color
    line = shape.line
    if border_color:
        line.color.rgb = border_color
        line.width = border_width
    else:
        line.fill.background()
    shape.shadow.inherit = False
    return shape


def add_accent_bar(slide, left, top, width, height, color=ACCENT_BLUE):
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    bar.fill.solid()
    bar.fill.fore_color.rgb = color
    bar.line.fill.background()
    bar.shadow.inherit = False
    return bar


def add_text_box(slide, left, top, width, height, text, font_size=14, color=TEXT_PRIMARY,
                 bold=False, alignment=PP_ALIGN.LEFT, font_name="맑은 고딕"):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = alignment
    return txBox


def add_bullet_text(slide, left, top, width, height, bullets, font_size=14, color=TEXT_PRIMARY,
                    spacing=Pt(6), font_name="맑은 고딕", line_spacing=1.3):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True

    for i, bullet in enumerate(bullets):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()

        is_sub = bullet.startswith("  ")
        text = bullet.strip().lstrip("- ").strip()

        if is_sub:
            p.text = text
            p.level = 1
            p.font.size = Pt(font_size - 1)
            p.font.color.rgb = TEXT_MUTED
            p.space_before = Pt(2)
            p.space_after = Pt(2)
            p.font.name = font_name
        else:
            p.text = text
            p.level = 0
            p.font.size = Pt(font_size)
            p.font.color.rgb = color
            p.font.bold = False
            p.space_before = spacing
            p.space_after = Pt(2)
            p.font.name = font_name

        p.line_spacing = line_spacing

    return txBox


def add_page_number(slide):
    slide_num = len(prs.slides)
    add_text_box(slide, Inches(12), Inches(7.1), Inches(1), Inches(0.3),
                 str(slide_num), font_size=10, color=TEXT_MUTED, alignment=PP_ALIGN.RIGHT)


def make_section_slide(title, subtitle="", section_idx=0):
    global current_section_idx
    current_section_idx = section_idx

    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)

    color = SECTION_COLORS[section_idx % len(SECTION_COLORS)]

    add_accent_bar(slide, Inches(0), Inches(0), Inches(0.12), SLIDE_H, color)

    num = str(section_idx + 1)
    circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(1.5), Inches(2.2), Inches(1.2), Inches(1.2))
    circle.fill.solid()
    circle.fill.fore_color.rgb = color
    circle.line.fill.background()
    circle.shadow.inherit = False
    tf = circle.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.text = num
    p.font.size = Pt(36)
    p.font.color.rgb = WHITE
    p.font.bold = True
    p.font.name = "맑은 고딕"
    p.alignment = PP_ALIGN.CENTER
    tf.paragraphs[0].space_before = Pt(12)

    add_text_box(slide, Inches(3.2), Inches(2.0), Inches(9), Inches(1.0),
                 title, font_size=40, color=TEXT_PRIMARY, bold=True)

    if subtitle:
        add_text_box(slide, Inches(3.2), Inches(3.2), Inches(9), Inches(0.6),
                     subtitle, font_size=18, color=TEXT_SECONDARY)

    add_accent_bar(slide, Inches(3.2), Inches(4.0), Inches(4), Inches(0.04), color)
    add_accent_bar(slide, Inches(0), Inches(7.38), SLIDE_W, Inches(0.06), color)


def make_content_slide(title, bullets):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)

    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]

    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)
    add_text_box(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7),
                 title, font_size=26, color=TEXT_PRIMARY, bold=True)
    add_accent_bar(slide, Inches(0.6), Inches(1.0), Inches(2), Inches(0.035), color)

    add_shape(slide, Inches(0.5), Inches(1.3), Inches(12.3), Inches(5.7),
              fill_color=CARD_BG, border_color=CARD_BORDER, border_width=Pt(1))

    add_bullet_text(slide, Inches(0.9), Inches(1.5), Inches(11.5), Inches(5.3),
                    bullets, font_size=16, line_spacing=1.4)

    add_page_number(slide)


def make_two_col_slide(title, left_title, left_bullets, right_title, right_bullets):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)

    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]

    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)
    add_text_box(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7),
                 title, font_size=26, color=TEXT_PRIMARY, bold=True)
    add_accent_bar(slide, Inches(0.6), Inches(1.0), Inches(2), Inches(0.035), color)

    # left card
    add_shape(slide, Inches(0.5), Inches(1.3), Inches(5.9), Inches(5.7),
              fill_color=CARD_BG, border_color=CARD_BORDER, border_width=Pt(1))
    if left_title:
        add_text_box(slide, Inches(0.8), Inches(1.4), Inches(5.3), Inches(0.5),
                     left_title, font_size=16, color=color, bold=True)
        add_bullet_text(slide, Inches(0.8), Inches(1.9), Inches(5.3), Inches(4.9),
                        left_bullets, font_size=14, line_spacing=1.35)
    else:
        add_bullet_text(slide, Inches(0.8), Inches(1.5), Inches(5.3), Inches(5.3),
                        left_bullets, font_size=14, line_spacing=1.35)

    # right card
    add_shape(slide, Inches(6.9), Inches(1.3), Inches(5.9), Inches(5.7),
              fill_color=CARD_BG, border_color=CARD_BORDER, border_width=Pt(1))
    if right_title:
        add_text_box(slide, Inches(7.2), Inches(1.4), Inches(5.3), Inches(0.5),
                     right_title, font_size=16, color=color, bold=True)
        add_bullet_text(slide, Inches(7.2), Inches(1.9), Inches(5.3), Inches(4.9),
                        right_bullets, font_size=14, line_spacing=1.35)
    else:
        add_bullet_text(slide, Inches(7.2), Inches(1.5), Inches(5.3), Inches(5.3),
                        right_bullets, font_size=14, line_spacing=1.35)

    add_page_number(slide)


def make_table_slide(title, headers, rows, col_widths=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)

    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]

    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)
    add_text_box(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7),
                 title, font_size=26, color=TEXT_PRIMARY, bold=True)
    add_accent_bar(slide, Inches(0.6), Inches(1.0), Inches(2), Inches(0.035), color)

    num_cols = len(headers)
    num_rows = len(rows) + 1
    table_width = Inches(12.0)
    table_left = Inches(0.65)
    table_top = Inches(1.4)
    row_height = Inches(0.55)
    table_height = row_height * num_rows

    table_shape = slide.shapes.add_table(num_rows, num_cols, table_left, table_top, table_width, table_height)
    table = table_shape.table

    if col_widths:
        for i, w in enumerate(col_widths):
            table.columns[i].width = Inches(w)

    # header row
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        cell.text = h
        for p in cell.text_frame.paragraphs:
            p.font.size = Pt(13)
            p.font.bold = True
            p.font.color.rgb = WHITE
            p.font.name = "맑은 고딕"
            p.alignment = PP_ALIGN.CENTER
        cell.fill.solid()
        cell.fill.fore_color.rgb = color

    # data rows
    for r_idx, row in enumerate(rows):
        for c_idx, val in enumerate(row):
            cell = table.cell(r_idx + 1, c_idx)
            cell.text = val
            for p in cell.text_frame.paragraphs:
                p.font.size = Pt(12)
                p.font.color.rgb = TEXT_PRIMARY
                p.font.name = "맑은 고딕"
                p.alignment = PP_ALIGN.LEFT if c_idx > 0 else PP_ALIGN.CENTER
            cell.fill.solid()
            cell.fill.fore_color.rgb = CARD_BG if r_idx % 2 == 0 else SLIDE_BG

    add_page_number(slide)


def make_quote_slide(quote, attribution=""):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide, RGBColor(0xF0, 0xF4, 0xF8))

    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]

    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)

    # large quote mark
    add_text_box(slide, Inches(1.5), Inches(1.5), Inches(1), Inches(1.2),
                 "“", font_size=80, color=color, bold=True)

    add_text_box(slide, Inches(2.0), Inches(2.3), Inches(9.5), Inches(2.5),
                 quote, font_size=28, color=TEXT_PRIMARY, bold=False)

    if attribution:
        add_text_box(slide, Inches(2.0), Inches(5.0), Inches(9.5), Inches(0.5),
                     attribution, font_size=16, color=TEXT_SECONDARY)

    add_accent_bar(slide, Inches(0), Inches(7.38), SLIDE_W, Inches(0.06), color)
    add_page_number(slide)


# ===================================================================
# SLIDE GENERATION
# ===================================================================

# --- Slide 1: Cover ---
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.06), ACCENT_BLUE)
add_accent_bar(slide, Inches(0), Inches(0.06), SLIDE_W, Inches(0.03), ACCENT_CYAN)

add_text_box(slide, Inches(1.5), Inches(1.5), Inches(10), Inches(1),
             "DC Express", font_size=52, color=ACCENT_BLUE, bold=True)
add_text_box(slide, Inches(1.5), Inches(2.5), Inches(10), Inches(0.8),
             "프로젝트 회고: 바이브 코딩 4.5개월의 기록", font_size=26, color=TEXT_SECONDARY)

add_accent_bar(slide, Inches(1.5), Inches(3.5), Inches(3), Inches(0.04), ACCENT_CYAN)

add_text_box(slide, Inches(1.5), Inches(4.0), Inches(10), Inches(0.6),
             "인프라 엔지니어 1명 + AI가 만든 DCIM 시스템", font_size=20, color=TEXT_PRIMARY)

add_bullet_text(slide, Inches(1.5), Inches(4.8), Inches(10), Inches(2), [
    "576 커밋  |  44,211줄  |  135개 기능  |  AI 99%+ 작성",
    "2026-02 ~ 06  |  서영재",
], font_size=16, color=TEXT_SECONDARY)

add_accent_bar(slide, Inches(0), Inches(7.38), SLIDE_W, Inches(0.06), ACCENT_BLUE)
add_accent_bar(slide, Inches(0), Inches(7.44), SLIDE_W, Inches(0.06), ACCENT_CYAN)


# --- Slide 2: TOC ---
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)

add_accent_bar(slide, Inches(0), Inches(0), Inches(0.08), SLIDE_H, ACCENT_BLUE)
add_text_box(slide, Inches(0.6), Inches(0.4), Inches(12), Inches(0.7),
             "목차", font_size=30, color=TEXT_PRIMARY, bold=True)
add_accent_bar(slide, Inches(0.6), Inches(1.15), Inches(2.5), Inches(0.04), ACCENT_CYAN)

toc_items = [
    "프로젝트 개요",
    "왜 만들었나 (Before/After)",
    "8단계 진화 타임라인",
    "바이브 코딩의 현실",
    "CLAUDE.md: 실패가 만든 규칙",
    "주요 피벗 사례",
    "가장 큰 깨달음: 프롬프트에서 도구로",
    "미로찾기와 AI",
    "잘한 것 / 아쉬운 것",
    "조직 적용 제안",
]
col1 = toc_items[:5]
col2 = toc_items[5:]

for i, sec in enumerate(col1):
    y = 1.6 + i * 0.85
    c = SECTION_COLORS[i]
    add_accent_bar(slide, Inches(0.6), Inches(y), Inches(0.06), Inches(0.5), c)
    add_text_box(slide, Inches(0.9), Inches(y + 0.05), Inches(5.5), Inches(0.35),
                 f"{i+1}.  {sec}", font_size=16, color=TEXT_PRIMARY)

for i, sec in enumerate(col2):
    y = 1.6 + i * 0.85
    idx = i + 5
    c = SECTION_COLORS[idx]
    add_accent_bar(slide, Inches(7.0), Inches(y), Inches(0.06), Inches(0.5), c)
    add_text_box(slide, Inches(7.3), Inches(y + 0.05), Inches(5.5), Inches(0.35),
                 f"{idx+1}.  {sec}", font_size=16, color=TEXT_PRIMARY)


# === Section 1: 프로젝트 개요 ===
make_section_slide("프로젝트 개요", "숫자로 보는 DC Express", section_idx=0)

make_table_slide("프로젝트 핵심 수치", ["항목", "수치"], [
    ["개발 기간", "4.5개월 (실질 2.5개월)"],
    ["개발 인원", "1명 (인프라 엔지니어, 웹 개발 비전공)"],
    ["총 커밋", "576개 (AI 99%+ 작성)"],
    ["소스 코드", "44,211줄 / 218개 파일"],
    ["API 엔드포인트", "74개"],
    ["페이지/뷰", "39개"],
    ["DB 모델", "29개 (Prisma)"],
    ["구현 기능", "135개 (features.md 기준)"],
    ["데이터 검증 스크립트", "116개 작성, 31개 결과 기록"],
    ["다국어 번역", "511개 키 (한/영)"],
], col_widths=[4.0, 8.0])


# === Section 2: 왜 만들었나 ===
make_section_slide("왜 만들었나", "기존 환경의 문제와 변화", section_idx=1)

make_two_col_slide("Before / After",
    "Before (기존 환경)",
    [
        "Grafana 대시보드 10개 이상 산재",
        "  서버 하나 확인에 3~4개 대시보드 이동",
        "엑셀 파일 수기 자산관리",
        "  버전 혼란, 보증 만료 추적 불가",
        "물리 배치를 담당자 기억에 의존",
        "  종이 배치도, 최신 상태 미반영",
        "BMC/IPMI 서버별 개별 접속",
        "용량 계획은 감에 의존",
    ],
    "After (DC Express)",
    [
        "통합 39페이지 + 74개 API",
        "  서버 클릭 한 번으로 전체 메트릭 확인",
        "DB 기반 CRUD + 라이프사이클 관리",
        "  등록 > 운영 > 수리 > 퇴역 > 폐기",
        "Digital Twin + 랙 다이어그램",
        "  드래그&드롭 배치, 온도 히트맵",
        "웹에서 원격 전원 제어 (BMC 프록시)",
        "12개월 예측 + PDF 리포트 자동 생성",
    ]
)


# === Section 3: 타임라인 ===
make_section_slide("8단계 진화 타임라인", "스캐폴딩부터 품질 감사까지", section_idx=2)

make_table_slide("Phase 1~4: 구축기", ["Phase", "시기", "내용", "교훈"], [
    ["1. 스캐폴딩", "4/8 (1일)", "프로젝트 구조, 스키마, 핵심 페이지", "며칠 걸릴 뼈대를 몇 시간에"],
    ["2. Docker 삽질", "4/9 (1일)", "Alpine > Debian (Prisma 호환)", "AI도 환경 차이는 부딪혀봐야"],
    ["3. 기능 폭발", "4/10~20", "Prometheus, RBAC, CSV, SSE, i18n", "속도는 압도적. 단, 실데이터에서 깨짐"],
    ["4. 실데이터 고통", "4말~5중", "node-exporter 39커밋, BMC 39커밋", "추측 코드의 대가. Data-First 탄생"],
], col_widths=[2.0, 2.0, 4.5, 3.5])

make_table_slide("Phase 5~8: 성숙기", ["Phase", "시기", "내용", "교훈"], [
    ["5. 규칙 정립", "5월 중~말", "CLAUDE.md 필수 규칙 축적", "규칙 = 실패의 압축"],
    ["6. 고도화", "6월", "Digital Twin, BMC 프록시, PUE", "규칙 덕에 실수 감소"],
    ["7. 문서화", "6/16~17", "매뉴얼, PPT 56슬라이드", "문서화도 AI가 코드를 읽고 작성"],
    ["8. 품질 감사", "6/22~25", "8명 에이전트 병렬 감사 + 도구화", "프롬프트에서 도구로의 전환"],
], col_widths=[2.0, 2.0, 4.5, 3.5])


# === Section 4: 바이브 코딩의 현실 ===
make_section_slide("바이브 코딩의 현실", "빠르게 만들고, 깨지고, 고치고", section_idx=3)

make_two_col_slide("커밋 유형 분석",
    "커밋 분포 (576건)",
    [
        "feat/add (새 기능): ~229건 (45%)",
        "fix (수정): ~120건 (23%)",
        "docs (문서): ~46건 (9%)",
        "refactor: 3건 (0.6%)",
        "기타 (update/check/sync): ~116건 (23%)",
    ],
    "핵심 인사이트",
    [
        "fix가 전체의 23% — 바이브 코딩의 자연스러운 리듬",
        "  \"빠르게 만들고 > 실환경에서 깨지고 > 고치고\"",
        "Phase 4(실데이터 고통기)에 fix 집중",
        "  Prometheus/BMC 연동만 78+ fix 커밋",
        "AI는 추측으로 코드를 짠다",
        "  실 데이터를 모르면 틀린 코드가 나옴",
        "리팩터링은 3건뿐",
        "  기능 추가에만 집중한 대가 = 기술 부채 축적",
    ]
)


# === Section 5: CLAUDE.md ===
make_section_slide("CLAUDE.md: 실패가 만든 규칙", "6개 필수 규칙의 탄생 배경", section_idx=4)

make_table_slide("실패에서 태어난 규칙", ["규칙", "어떤 실패에서 탄생했나"], [
    ["Data-First 개발", "Prometheus 쿼리를 추측으로 작성 > 실데이터에서 전부 실패"],
    ["폐쇄망 제약 기록", "\"파일로 push하세요\" > \"여기는 폐쇄망입니다\" 답변"],
    ["중복 구현 방지", "세션 요약으로 넘어오면서 AI가 이미 만든 기능을 다시 만듦"],
    ["변경 영향 분석", "API 응답 구조 변경 > 프론트엔드 3곳 깨짐"],
    ["팀A/팀B 토론", "AI 단독 설계 판단 > 나중에 후회"],
    ["검증 루틴", "tsc + test 통과 > 런타임 에러 발생"],
], col_widths=[3.0, 9.0])


# === Section 6: 피벗 사례 ===
make_section_slide("주요 피벗 사례", "부딪혀봐야 아는 것들", section_idx=5)

make_content_slide("기술적 피벗 3가지", [
    "Docker Alpine > Debian Slim",
    "  Prisma의 OpenSSL 의존성이 Alpine musl과 호환 불가",
    "  fix 3번 시도 후 베이스 이미지 자체 교체",
    "",
    "cAdvisor 전용 > node-exporter 우선",
    "  cAdvisor는 hostname 형식, node-exporter는 IP:port 형식",
    "  실측 후 node-exporter가 DB 매핑에 안정적 > PromQL or 폴백 전략",
    "",
    "hostname/IP 매핑 3곳 분산 > 통합",
    "  같은 매핑 로직이 3곳에 흩어져 불일치 발생",
    "  hostname-resolver.ts 단일 모듈로 리팩터링",
    "",
    "프로덕션 빌드 전환 삽질 (4번 시도, 에이전트 12명)",
    "  ISR 프리렌더링 + pako 타입 문제",
    "  \"이 에러를 어떻게 고치지?\" 대신 \"성공 전제 조건은?\"을 물어야 했다",
])


# === Section 7: 가장 큰 깨달음 ===
make_section_slide("가장 큰 깨달음", "프롬프트로 버텼지만, 도구로 박았어야 했다", section_idx=6)

make_quote_slide(
    "나는 모든 규칙을 \"말(프롬프트)\"로 유지해왔다.\n"
    "말은 매번 다시 해야 하고, 세션이 바뀌면 사라지고,\n"
    "조금씩 변형된다.",
    "세 번 반복한 프롬프트는 자산화(도구화) 신호다."
)

make_two_col_slide("도구화 3종 — 회고 후 실제 구현",
    "증거 (도구화 전)",
    [
        "CLAUDE.md를 25번 수정",
        "  자동화되지 않은 규칙을 손으로 다듬어왔다",
        "팀A/팀B를 매번 프롬프트로 호출",
        "  가장 자주 쓰는 프로세스인데 매번 새로 생성",
        "fix 커밋이 전체의 23%",
        "  검증을 매번 수동으로 > 빠뜨림 > 깨짐 > 고침",
        "폐쇄망 확인 스크립트 매번 수작업",
        "  Data-First 규칙이 텍스트로만 존재",
    ],
    "구현 완료 (도구화 후)",
    [
        "서브에이전트 (.claude/agents/)",
        "  team-a.md, team-b.md, impact-analyzer.md",
        "  이름만 호출하면 동일한 관점으로 분석 시작",
        "훅 (SessionStart)",
        "  세션 시작 시 prisma generate 자동 실행",
        "  스키마 변경 후 불일치 오류 원천 차단",
        "스킬 (/data-first-check, /feature-sync)",
        "  슬래시 커맨드 한 줄로 규칙 실행",
        "  폐쇄망 출력 최소화 규칙이 스킬 안에 하드코딩",
    ]
)


# === Section 8: 미로찾기와 AI ===
make_section_slide("미로찾기와 AI", "막다른 길을 인지하는 능력", section_idx=7)

make_two_col_slide("신문 미로 vs 현실 미로",
    "신문 미로 (쉬운 문제)",
    [
        "시작점과 목표점이 한눈에 보인다",
        "목표에서 거꾸로 올라가며 경로를 찾는다",
        "갈림길에서 어디로 가야 하는지 이미 안다",
        "틀릴 일이 거의 없다",
    ],
    "현실 미로 (AI와의 개발)",
    [
        "목표점이 안개 속에 있다",
        "  대략적인 방향만 있을 뿐",
        "지금 서 있는 곳 주변만 보인다",
        "  전체 지도가 없다",
        "갈림길에서 확률적으로 선택해야 한다",
        "잘못된 방향으로 깊이 들어가면",
        "  그 안에서 아무리 발버둥쳐도 해결 안 됨",
    ]
)

make_content_slide("AI를 잘 쓰는 4가지 원칙", [
    "원칙 1: 같은 자리를 3번 맴돌면 멈춰라",
    "  같은 에러가 3번 반복되면 더 시도하지 말고 멈춘다",
    "  = 같은 막다른 길 안에서 벽을 더 세게 치는 것",
    "",
    "원칙 2: AI를 바꾸지 말고, 질문을 바꿔라",
    "  나쁜 질문: \"이 에러를 어떻게 고치지?\" (증상)",
    "  좋은 질문: \"성공 전제 조건이 뭐지?\" (구조)",
    "  더 좋은 질문: \"이 접근 자체가 맞는지 검증해줘\" (방향)",
    "",
    "원칙 3: 사람이 방향을 잡고, AI가 실행한다",
    "  \"지금 우리가 잘못된 길에 있다\"는 판단은 사람의 몫",
    "",
    "원칙 4: 새 세션이 때로는 최고의 해결책이다",
    "  긴 대화에서 AI도 맥락에 갇힌다. 처음부터 다시 설명하면 다른 접근이 나온다",
])


# === Section 9: 잘한 것 / 아쉬운 것 ===
make_section_slide("잘한 것 / 아쉬운 것", "Keep & Improve", section_idx=8)

make_two_col_slide("KPT 회고",
    "잘한 것 (Keep)",
    [
        "Data-First 개발 규칙 도입",
        "  116개 확인 스크립트 + 31개 결과 기록",
        "  추측 코드 > 실패 사이클을 단축",
        "CLAUDE.md를 \"실패 로그의 압축판\"으로 활용",
        "  6개 필수 규칙이 같은 실수 반복 방지",
        "features.md를 Single Source of Truth로 지정",
        "  세션 넘어갈 때 중복 구현 방지에 결정적",
        "팀A/팀B 토론 프로세스",
        "  설계 판단의 편향 방지",
        "병렬 에이전트 활용 (4~8명 동시 투입)",
    ],
    "아쉬운 것 (Improve)",
    [
        "초기 기획이 더 구체적이었으면",
        "  DB 스키마, API 설계를 먼저 정의했으면 Phase 4 수정 감소",
        "리팩터링을 미루지 말았어야",
        "  576커밋 중 refactor 3건뿐 > 기술 부채 축적",
        "테스트 커버리지 부족",
        "  8개 테스트 파일로 44,211줄은 부족",
        "  핵심 경로 테스트는 초기부터 잡았어야",
        "폐쇄망 제약을 처음부터 기록했어야",
        "  초기 장황한 출력 > 사용자 부담",
        "커밋 메시지 규칙이 느슨했음",
    ]
)


# === Section 10: 조직 적용 제안 ===
make_section_slide("조직 적용 제안", "바이브 코딩, 어디에 쓸 수 있나", section_idx=9)

make_two_col_slide("적합 영역 vs 부적합 영역",
    "적합",
    [
        "내부 관리 도구, 대시보드, PoC",
        "도메인 전문가가 직접 자신의 도구를 만드는 경우",
        "외부 노출이 없는 시스템",
        "",
        "비용 효율성",
        "  1인+AI 4.5개월·~4,500만 원 vs 외주 6~9개월·3.5~5.5억 원",
        "  비용 ~8~11배 절감 (상세: 다음 슬라이드)",
    ],
    "부적합",
    [
        "고객 대면 서비스 (UI 품질, 접근성, 성능)",
        "보안 민감 시스템 (인증/결제/개인정보)",
        "높은 가용성이 필요한 프로덕션 서비스",
        "",
        "적용 시 필수 조건",
        "  CLAUDE.md 규칙 체계 (프로젝트 헌법)",
        "  Data-First 원칙 (추측 금지)",
        "  도메인 지식을 가진 감독자",
        "  features.md 같은 단일 진실 공급원",
    ]
)

make_content_slide("경제성 — 1인+AI vs 외주 개발", [
    "규모: 기능점수 ~700 FP · 44,211 LOC · API 74 · 화면 39 · DB 29모델",
    "",
    "외주 예상 (팀 3~4명: PL·백엔드·프론트·QA)",
    "  기간 6~9개월 · 투입 25~35 맨먼스",
    "  비용 3.5~5.5억 원 (SI 대가 기준)",
    "",
    "1인 + AI (실제)",
    "  기간 4.5개월 · 투입 4.5 맨먼스",
    "  비용 ~4,500만 원 (인건비 ~4천만 + AI 구독 ~100만)",
    "",
    "효과: 비용 ~8~11배 절감 · 인당 생산성 ~155 FP/MM (외주 ~7~8배)",
    "1인 기준(AI 없이)이면 ~2.5~3년 → AI로 4.5개월 (약 6~8배 단축)",
])


# --- Final slide: 핵심 메시지 ---
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, RGBColor(0xF0, 0xF4, 0xF8))

add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.06), ACCENT_BLUE)

add_text_box(slide, Inches(1.5), Inches(1.5), Inches(10), Inches(1.0),
             "핵심 메시지", font_size=36, color=ACCENT_BLUE, bold=True)

add_accent_bar(slide, Inches(1.5), Inches(2.5), Inches(3), Inches(0.04), ACCENT_CYAN)

add_text_box(slide, Inches(1.5), Inches(3.0), Inches(10), Inches(1.5),
             "규칙을 말로 유지하지 말고, 파일로 만들어라.\n"
             "세 번 반복한 프롬프트는 자산화(도구화) 신호다.",
             font_size=24, color=TEXT_PRIMARY, bold=False)

add_text_box(slide, Inches(1.5), Inches(4.8), Inches(10), Inches(1.0),
             "미로의 막다른 길을 인지하는 것은 AI가 아니라 사람의 몫이다.\n"
             "그리고 되돌아가는 용기가 있을 때, 가장 빠르게 목표에 도달한다.",
             font_size=20, color=TEXT_SECONDARY, bold=False)

add_accent_bar(slide, Inches(1.5), Inches(6.0), Inches(3), Inches(0.04), ACCENT_CYAN)

add_text_box(slide, Inches(1.5), Inches(6.3), Inches(10), Inches(0.5),
             "Q & A", font_size=28, color=ACCENT_BLUE, bold=True)

add_accent_bar(slide, Inches(0), Inches(7.38), SLIDE_W, Inches(0.06), ACCENT_BLUE)
add_accent_bar(slide, Inches(0), Inches(7.44), SLIDE_W, Inches(0.06), ACCENT_CYAN)


# ===================================================================
# SAVE
# ===================================================================
output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "retrospective-presentation.pptx")
prs.save(output_path)
print(f"Saved: {output_path}")
print(f"Total slides: {len(prs.slides)}")
