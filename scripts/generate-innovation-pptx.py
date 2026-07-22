#!/usr/bin/env python3
"""DC Express 완료보고 — AI 기반 업무 혁신 PowerPoint 생성 스크립트.

공청회/완료보고용. 회고 PPT(generate-retro-pptx.py)와 동일한 디자인 시스템을 쓰되,
'AI 활용 사례 → 효과(비용·자동화·품질) → 운영 계획 → 혁신 방향성' 구조로 재편.
수치 출처: docs/cost-comparison-20260630.md, final-report.md, uml-diagrams.md,
test-summary.md, operations-plan.md, git 이력 실측 (4-에이전트 검토, 2026-07-06).
"""

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# === Color Palette (기존 산출물 PPT와 동일) ===
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
CARD_BG = RGBColor(0xF8, 0xF9, 0xFB)
CARD_BORDER = RGBColor(0xE0, 0xE0, 0xE8)

SECTION_COLORS = [
    ACCENT_BLUE, ACCENT_CYAN, ACCENT_PURPLE, ACCENT_ORANGE,
    ACCENT_RED, ACCENT_GREEN, RGBColor(0x06, 0xB6, 0xD4),
]

current_section_idx = 0

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


def set_slide_bg(slide, color=SLIDE_BG):
    fill = slide.background.fill
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
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        is_sub = bullet.startswith("  ")
        text = bullet.strip().lstrip("- ").strip()
        if is_sub:
            p.text = text
            p.level = 1
            p.font.size = Pt(font_size - 1)
            p.font.color.rgb = TEXT_MUTED
            p.space_before = Pt(2)
            p.space_after = Pt(2)
        else:
            p.text = text
            p.level = 0
            p.font.size = Pt(font_size)
            p.font.color.rgb = color
            p.space_before = spacing
            p.space_after = Pt(2)
        p.font.name = font_name
        p.line_spacing = line_spacing
    return txBox


def add_page_number(slide):
    add_text_box(slide, Inches(12), Inches(7.1), Inches(1), Inches(0.3),
                 str(len(prs.slides)), font_size=10, color=TEXT_MUTED, alignment=PP_ALIGN.RIGHT)


def make_section_slide(title, subtitle="", section_idx=0):
    global current_section_idx
    current_section_idx = section_idx
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    color = SECTION_COLORS[section_idx % len(SECTION_COLORS)]
    add_accent_bar(slide, Inches(0), Inches(0), Inches(0.12), SLIDE_H, color)
    circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(1.5), Inches(2.2), Inches(1.2), Inches(1.2))
    circle.fill.solid()
    circle.fill.fore_color.rgb = color
    circle.line.fill.background()
    circle.shadow.inherit = False
    tf = circle.text_frame
    p = tf.paragraphs[0]
    p.text = str(section_idx + 1)
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


def make_content_slide(title, bullets, footnote=""):
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
    if footnote:
        add_text_box(slide, Inches(0.6), Inches(7.05), Inches(11), Inches(0.35),
                     footnote, font_size=10, color=TEXT_MUTED)
    add_page_number(slide)


def make_two_col_slide(title, left_title, left_bullets, right_title, right_bullets):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]
    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)
    add_text_box(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7),
                 title, font_size=26, color=TEXT_PRIMARY, bold=True)
    add_accent_bar(slide, Inches(0.6), Inches(1.0), Inches(2), Inches(0.035), color)
    add_shape(slide, Inches(0.5), Inches(1.3), Inches(5.9), Inches(5.7),
              fill_color=CARD_BG, border_color=CARD_BORDER, border_width=Pt(1))
    add_text_box(slide, Inches(0.8), Inches(1.4), Inches(5.3), Inches(0.5),
                 left_title, font_size=16, color=color, bold=True)
    add_bullet_text(slide, Inches(0.8), Inches(1.9), Inches(5.3), Inches(4.9),
                    left_bullets, font_size=14, line_spacing=1.35)
    add_shape(slide, Inches(6.9), Inches(1.3), Inches(5.9), Inches(5.7),
              fill_color=CARD_BG, border_color=CARD_BORDER, border_width=Pt(1))
    add_text_box(slide, Inches(7.2), Inches(1.4), Inches(5.3), Inches(0.5),
                 right_title, font_size=16, color=color, bold=True)
    add_bullet_text(slide, Inches(7.2), Inches(1.9), Inches(5.3), Inches(4.9),
                    right_bullets, font_size=14, line_spacing=1.35)
    add_page_number(slide)


def make_table_slide(title, headers, rows, col_widths=None, footnote="", font_pt=12, row_h=0.55):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]
    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)
    add_text_box(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7),
                 title, font_size=26, color=TEXT_PRIMARY, bold=True)
    add_accent_bar(slide, Inches(0.6), Inches(1.0), Inches(2), Inches(0.035), color)
    num_cols = len(headers)
    num_rows = len(rows) + 1
    table_shape = slide.shapes.add_table(num_rows, num_cols, Inches(0.65), Inches(1.35),
                                         Inches(12.0), Inches(row_h) * num_rows)
    table = table_shape.table
    if col_widths:
        for i, w in enumerate(col_widths):
            table.columns[i].width = Inches(w)
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        cell.text = h
        for p in cell.text_frame.paragraphs:
            p.font.size = Pt(font_pt + 1)
            p.font.bold = True
            p.font.color.rgb = WHITE
            p.font.name = "맑은 고딕"
            p.alignment = PP_ALIGN.CENTER
        cell.fill.solid()
        cell.fill.fore_color.rgb = color
    for r_idx, row in enumerate(rows):
        for c_idx, val in enumerate(row):
            cell = table.cell(r_idx + 1, c_idx)
            cell.text = val
            for p in cell.text_frame.paragraphs:
                p.font.size = Pt(font_pt)
                p.font.color.rgb = TEXT_PRIMARY
                p.font.name = "맑은 고딕"
                p.alignment = PP_ALIGN.LEFT if c_idx > 0 else PP_ALIGN.CENTER
            cell.fill.solid()
            cell.fill.fore_color.rgb = CARD_BG if r_idx % 2 == 0 else SLIDE_BG
    if footnote:
        add_text_box(slide, Inches(0.65), Inches(1.35) + Inches(row_h) * num_rows + Inches(0.12),
                     Inches(12), Inches(0.6), footnote, font_size=10, color=TEXT_MUTED)
    add_page_number(slide)


def make_quote_slide(quote, attribution=""):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide, RGBColor(0xF0, 0xF4, 0xF8))
    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]
    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)
    add_text_box(slide, Inches(1.5), Inches(1.5), Inches(1), Inches(1.2),
                 "“", font_size=80, color=color, bold=True)
    add_text_box(slide, Inches(2.0), Inches(2.3), Inches(9.5), Inches(2.5),
                 quote, font_size=28, color=TEXT_PRIMARY)
    if attribution:
        add_text_box(slide, Inches(2.0), Inches(5.0), Inches(9.5), Inches(0.5),
                     attribution, font_size=16, color=TEXT_SECONDARY)
    add_accent_bar(slide, Inches(0), Inches(7.38), SLIDE_W, Inches(0.06), color)
    add_page_number(slide)


from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.chart import XL_LABEL_POSITION


def make_chart_slide(title, categories, values, chart_type="bar", highlight_idx=None,
                     value_labels=None, footnote="", bar_color=None, subtitle=""):
    """단일 시리즈 막대/가로막대/꺾은선 차트 슬라이드.
    highlight_idx: 강조할 데이터포인트 인덱스(초록). value_labels: 막대에 표시할 문자열 배열."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]
    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)
    add_text_box(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7),
                 title, font_size=26, color=TEXT_PRIMARY, bold=True)
    add_accent_bar(slide, Inches(0.6), Inches(1.0), Inches(2), Inches(0.035), color)
    if subtitle:
        add_text_box(slide, Inches(0.65), Inches(1.05), Inches(12), Inches(0.4),
                     subtitle, font_size=14, color=TEXT_SECONDARY)

    cd = CategoryChartData()
    cd.categories = categories
    cd.add_series("값", values)
    ctype = {
        "bar": XL_CHART_TYPE.BAR_CLUSTERED,       # 가로 막대
        "column": XL_CHART_TYPE.COLUMN_CLUSTERED, # 세로 막대
        "line": XL_CHART_TYPE.LINE_MARKERS,
    }[chart_type]
    top = Inches(1.55) if subtitle else Inches(1.35)
    gf = slide.shapes.add_chart(ctype, Inches(0.7), top, Inches(11.9), Inches(5.2), cd)
    chart = gf.chart
    chart.has_legend = False
    chart.has_title = False

    plot = chart.plots[0]
    plot.has_data_labels = True
    dl = plot.data_labels
    dl.font.size = Pt(14)
    dl.font.bold = True
    dl.font.name = "맑은 고딕"
    dl.number_format = "General"
    dl.number_format_is_linked = False

    series = chart.series[0]
    base = bar_color or color
    # 전체 기본색
    series.format.fill.solid()
    series.format.fill.fore_color.rgb = base
    # 포인트별 색(강조는 초록, 나머지는 회색톤 + base)
    for i in range(len(categories)):
        pt = series.points[i]
        pt.format.fill.solid()
        if highlight_idx is not None and i == highlight_idx:
            pt.format.fill.fore_color.rgb = ACCENT_GREEN
        else:
            pt.format.fill.fore_color.rgb = base

    # 축 폰트
    try:
        chart.category_axis.tick_labels.font.size = Pt(13)
        chart.category_axis.tick_labels.font.name = "맑은 고딕"
        chart.value_axis.has_major_gridlines = True
        chart.value_axis.tick_labels.font.size = Pt(11)
    except Exception:
        pass

    # 커스텀 라벨 문자열(예: "4.5개월", "~0.45억") — 데이터라벨 텍스트 덮어쓰기
    if value_labels:
        try:
            for i, txt in enumerate(value_labels):
                pt = series.points[i]
                pt.data_label.has_text_frame = True
                pt.data_label.text_frame.text = txt
                for p in pt.data_label.text_frame.paragraphs:
                    p.font.size = Pt(13)
                    p.font.bold = True
                    p.font.name = "맑은 고딕"
                    p.font.color.rgb = TEXT_PRIMARY
        except Exception:
            pass

    if footnote:
        add_text_box(slide, Inches(0.65), Inches(6.95), Inches(12), Inches(0.4),
                     footnote, font_size=10, color=TEXT_MUTED)
    add_page_number(slide)


def make_pie_slide(title, categories, values, subtitle="", footnote="", colors=None):
    """도넛 차트 슬라이드 (구성비). 데이터라벨=카테고리+백분율."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]
    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)
    add_text_box(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7),
                 title, font_size=26, color=TEXT_PRIMARY, bold=True)
    add_accent_bar(slide, Inches(0.6), Inches(1.0), Inches(2), Inches(0.035), color)
    if subtitle:
        add_text_box(slide, Inches(0.65), Inches(1.05), Inches(12), Inches(0.4),
                     subtitle, font_size=14, color=TEXT_SECONDARY)

    cd = CategoryChartData()
    cd.categories = categories
    cd.add_series("구성비", values)
    gf = slide.shapes.add_chart(XL_CHART_TYPE.DOUGHNUT, Inches(2.6), Inches(1.6),
                                Inches(8.1), Inches(5.2), cd)
    chart = gf.chart
    chart.has_title = False
    chart.has_legend = True
    chart.legend.position = XL_LEGEND_POSITION.RIGHT
    chart.legend.include_in_layout = False
    chart.legend.font.size = Pt(13)
    chart.legend.font.name = "맑은 고딕"

    plot = chart.plots[0]
    plot.has_data_labels = True
    dl = plot.data_labels
    dl.show_percentage = True
    dl.show_category_name = False
    dl.number_format = "0%"
    dl.number_format_is_linked = False
    dl.font.size = Pt(13)
    dl.font.bold = True
    dl.font.name = "맑은 고딕"
    dl.font.color.rgb = WHITE

    palette = colors or [SECTION_COLORS[0], ACCENT_ORANGE, ACCENT_CYAN, TEXT_MUTED,
                         ACCENT_PURPLE, ACCENT_GREEN]
    series = chart.series[0]
    for i in range(len(categories)):
        pt = series.points[i]
        pt.format.fill.solid()
        pt.format.fill.fore_color.rgb = palette[i % len(palette)]

    if footnote:
        add_text_box(slide, Inches(0.65), Inches(6.95), Inches(12), Inches(0.4),
                     footnote, font_size=10, color=TEXT_MUTED)
    add_page_number(slide)


# --- 인포그래픽 색 ---
BEFORE_BG = RGBColor(0xFD, 0xEC, 0xEC)
BEFORE_TX = RGBColor(0xB4, 0x2B, 0x2B)
AFTER_BG = RGBColor(0xE7, 0xF6, 0xEC)
AFTER_TX = RGBColor(0x15, 0x7F, 0x3C)


def _slide_header(title, subtitle=""):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide)
    color = SECTION_COLORS[current_section_idx % len(SECTION_COLORS)]
    add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.05), color)
    add_text_box(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7),
                 title, font_size=26, color=TEXT_PRIMARY, bold=True)
    add_accent_bar(slide, Inches(0.6), Inches(1.0), Inches(2), Inches(0.035), color)
    if subtitle:
        add_text_box(slide, Inches(0.65), Inches(1.05), Inches(12), Inches(0.4),
                     subtitle, font_size=14, color=TEXT_SECONDARY)
    return slide, color


def _card_text(slide, left, top, width, height, text, bg, tx, size=13, bold=False, align=PP_ALIGN.LEFT):
    add_shape(slide, left, top, width, height, fill_color=bg, border_color=None)
    tb = slide.shapes.add_textbox(left + Inches(0.12), top, width - Inches(0.24), height)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = 3  # MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(size)
    p.font.color.rgb = tx
    p.font.bold = bold
    p.font.name = "맑은 고딕"
    p.alignment = align


def make_before_after_slide(title, rows, subtitle=""):
    """rows: [(before, after), ...]  좌우 대비 인포그래픽."""
    slide, color = _slide_header(title, subtitle)
    top0 = Inches(1.75)
    row_h = Inches(0.82)
    gap = Inches(0.12)
    lw, aw = Inches(5.4), Inches(5.4)
    lx, arrow_x, ax = Inches(0.6), Inches(6.15), Inches(7.35)
    # 헤더
    _card_text(slide, lx, top0, lw, Inches(0.5), "Before — 기존 방식", BEFORE_BG, BEFORE_TX, size=15, bold=True, align=PP_ALIGN.CENTER)
    _card_text(slide, ax, top0, aw, Inches(0.5), "After — DC Express", AFTER_BG, AFTER_TX, size=15, bold=True, align=PP_ALIGN.CENTER)
    y = top0 + Inches(0.62)
    for before, after in rows:
        _card_text(slide, lx, y, lw, row_h, before, BEFORE_BG, BEFORE_TX, size=12)
        add_text_box(slide, arrow_x, y + Inches(0.18), Inches(1.1), Inches(0.5), "➜",
                     font_size=22, color=color, bold=True, alignment=PP_ALIGN.CENTER)
        _card_text(slide, ax, y, aw, row_h, after, AFTER_BG, AFTER_TX, size=12, bold=True)
        y = y + row_h + gap
    add_page_number(slide)


def make_kpi_slide(title, tiles, subtitle="", cols=4):
    """tiles: [(value, label), ...]  빅넘버 타일 그리드."""
    slide, color = _slide_header(title, subtitle)
    import math
    n = len(tiles)
    rows = math.ceil(n / cols)
    margin = Inches(0.6)
    gap = Inches(0.3)
    total_w = SLIDE_W - margin * 2
    card_w = (total_w - gap * (cols - 1)) / cols
    card_h = Inches(1.9) if rows <= 2 else Inches(1.5)
    top0 = Inches(1.9)
    palette = [SECTION_COLORS[0], ACCENT_CYAN, ACCENT_PURPLE, ACCENT_ORANGE,
               ACCENT_GREEN, ACCENT_RED, RGBColor(0x06, 0xB6, 0xD4), ACCENT_BLUE]
    for i, (value, label) in enumerate(tiles):
        r, c = divmod(i, cols)
        x = margin + c * (card_w + gap)
        y = top0 + r * (card_h + gap)
        add_shape(slide, x, y, card_w, card_h, fill_color=CARD_BG, border_color=CARD_BORDER, border_width=Pt(1))
        add_accent_bar(slide, x, y, card_w, Inches(0.08), palette[i % len(palette)])
        vb = slide.shapes.add_textbox(x, y + Inches(0.28), card_w, Inches(0.85))
        vp = vb.text_frame.paragraphs[0]
        vp.text = str(value)
        vp.font.size = Pt(40)
        vp.font.bold = True
        vp.font.color.rgb = palette[i % len(palette)]
        vp.font.name = "맑은 고딕"
        vp.alignment = PP_ALIGN.CENTER
        lb = slide.shapes.add_textbox(x, y + card_h - Inches(0.55), card_w, Inches(0.5))
        lp = lb.text_frame.paragraphs[0]
        lp.text = label
        lp.font.size = Pt(13)
        lp.font.color.rgb = TEXT_SECONDARY
        lp.font.name = "맑은 고딕"
        lp.alignment = PP_ALIGN.CENTER
    add_page_number(slide)


def make_timeline_slide(title, stages, subtitle=""):
    """stages: [(num, name, date), ...]  가로 타임라인."""
    slide, color = _slide_header(title, subtitle)
    n = len(stages)
    margin = Inches(0.75)
    span = SLIDE_W - margin * 2
    line_y = Inches(4.0)
    add_accent_bar(slide, margin, line_y, span, Inches(0.04), color)
    step = span / n
    palette = SECTION_COLORS
    for i, (num, name, date) in enumerate(stages):
        cx = margin + step * i + step / 2
        # 날짜(위)
        add_text_box(slide, cx - Inches(0.75), line_y - Inches(1.0), Inches(1.5), Inches(0.4),
                     date, font_size=11, color=TEXT_MUTED, alignment=PP_ALIGN.CENTER)
        # 노드
        d = Inches(0.55)
        circ = slide.shapes.add_shape(MSO_SHAPE.OVAL, cx - d / 2, line_y - d / 2 + Inches(0.02), d, d)
        circ.fill.solid()
        circ.fill.fore_color.rgb = palette[i % len(palette)]
        circ.line.color.rgb = WHITE
        circ.line.width = Pt(2)
        circ.shadow.inherit = False
        cp = circ.text_frame.paragraphs[0]
        cp.text = str(num)
        cp.font.size = Pt(15)
        cp.font.bold = True
        cp.font.color.rgb = WHITE
        cp.font.name = "맑은 고딕"
        cp.alignment = PP_ALIGN.CENTER
        # 이름(아래)
        add_text_box(slide, cx - Inches(0.85), line_y + Inches(0.55), Inches(1.7), Inches(1.6),
                     name, font_size=11, color=TEXT_PRIMARY, bold=True, alignment=PP_ALIGN.CENTER)
    add_page_number(slide)


def make_flow_slide(title, steps, subtitle="", note=""):
    """steps: [name, ...]  가로 화살표 플로우(각 단계 박스 + ▶)."""
    slide, color = _slide_header(title, subtitle)
    n = len(steps)
    margin = Inches(0.6)
    total_w = SLIDE_W - margin * 2
    arrow_w = Inches(0.5)
    box_w = (total_w - arrow_w * (n - 1)) / n
    box_h = Inches(1.6)
    y = Inches(3.0)
    palette = SECTION_COLORS
    x = margin
    for i, step in enumerate(steps):
        box = add_shape(slide, x, y, box_w, box_h, fill_color=palette[i % len(palette)], border_color=None)
        tf = box.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = 3
        p = tf.paragraphs[0]
        p.text = step
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.font.name = "맑은 고딕"
        p.alignment = PP_ALIGN.CENTER
        x = x + box_w
        if i < n - 1:
            add_text_box(slide, x, y + Inches(0.5), arrow_w, Inches(0.6), "▶",
                         font_size=20, color=TEXT_MUTED, bold=True, alignment=PP_ALIGN.CENTER)
            x = x + arrow_w
    if note:
        add_text_box(slide, margin, y + box_h + Inches(0.4), total_w, Inches(1.5),
                     note, font_size=14, color=TEXT_SECONDARY)
    add_page_number(slide)


# ===================================================================
# SLIDES
# ===================================================================

# --- 1. 표지 ---
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.06), ACCENT_BLUE)
add_accent_bar(slide, Inches(0), Inches(0.06), SLIDE_W, Inches(0.03), ACCENT_CYAN)
add_text_box(slide, Inches(1.5), Inches(1.4), Inches(10.5), Inches(1),
             "DC Express 완료보고", font_size=48, color=ACCENT_BLUE, bold=True)
add_text_box(slide, Inches(1.5), Inches(2.4), Inches(10.5), Inches(0.8),
             "AI를 활용한 대표 개발 사례와 업무 혁신 방향", font_size=26, color=TEXT_SECONDARY)
add_text_box(slide, Inches(1.5), Inches(4.6), Inches(10), Inches(0.5),
             "데이터센터 통합관리 시스템(DCIM) 구축 · 공청회 발표자료", font_size=16, color=TEXT_MUTED)
add_text_box(slide, Inches(1.5), Inches(5.1), Inches(10), Inches(0.5),
             "2026. 07  |  서영재", font_size=16, color=TEXT_MUTED)
add_accent_bar(slide, Inches(0), Inches(7.38), SLIDE_W, Inches(0.06), ACCENT_BLUE)

# --- 2. Executive Summary ---
current_section_idx = 0
make_content_slide("한 장 요약 (Executive Summary)", [
    "무엇을: Grafana 10개+ 대시보드·엑셀·수기 배치도로 흩어진 데이터센터 운영을 통합 DCIM 웹 시스템으로 구축",
    "  39개 화면 · 74개 API · 135개 기능 · 44,211줄 — 인프라 엔지니어 1명 + AI, 4.5개월 (커밋의 99%+를 AI가 작성)",
    "어떻게: AI를 '코드 생성기'가 아니라 구현·감사·문서화·운영을 함께 하는 협업 체계로 운용",
    "  프롬프트 → 규칙(CLAUDE.md) → 도구(에이전트·스킬·훅) 3단계 진화",
    "효과 ①비용: 외주 환산 3.5~5.5억 원 → 약 4,500만 원 (~8~11배 절감, 추정)",
    "효과 ②자동화: 반복 운영업무 주 8~10시간 절감 추정 (연 400시간+) + 24×7 무인 감시",
    "효과 ③품질: 릴리즈 전 AI 다중 감사로 이슈 65건+ 선제 발견 (보안·권한 우회 7건 수정)",
    "방향성: 이 사례의 규칙·도구를 템플릿화하여 타 업무로 확산 — '프롬프트 엔지니어링'에서 '워크플로 엔지니어링'으로",
])

# --- 3. 목차 ---
make_content_slide("목차", [
    "1. 프로젝트 개요 — 배경·시스템 소개·핵심 수치",
    "2. AI 활용 방법 — 구현·병렬 감사·문서 생성·운영 지원 (상세 사례)",
    "3. 개발 비용·기간 단축 효과 — 기능점수(FP)·맨먼스 기준",
    "4. 업무 자동화·생산성 향상 — Before/After와 절감 추정",
    "5. 에러 감소·품질 개선 — 3층 방어 체계와 실증 데이터",
    "6. 향후 운영 계획 — 점검·장애 대응·백업·릴리즈",
    "7. AI 기반 업무 혁신 방향성 — 조직 확산 제안",
])

# ==================== §1 프로젝트 개요 ====================
make_section_slide("프로젝트 개요", "왜 만들었고, 무엇이 만들어졌나", 0)

make_two_col_slide("추진 배경 — 흩어진 운영 도구",
    "Before: 도구 파편화", [
        "모니터링: Grafana 대시보드 10개+ 산재",
        "  서버 1대 확인에 3~4개 대시보드 이동",
        "자산 관리: 엑셀 수기 — 최신본·버전 혼란, 이력 없음",
        "물리 배치: 담당자 기억 + 종이 도면",
        "전원 제어: 서버별 IPMI 개별 접속",
        "용량 계획: 감(느낌) 의존, 보고서 수작업",
        "만료 관리(보증·인증서): 체계적 추적 부재",
    ],
    "After: 통합 DCIM 한 화면", [
        "서버 클릭 1번 → CPU·메모리·디스크·온도·전력·PCIe·BMC 센서 통합",
        "DB 기반 자산 CRUD + 라이프사이클 9단계 + 변경 이력",
        "Digital Twin(룸·랙 시각화) + 히트맵 + 드래그 배치",
        "웹에서 원격 전원 제어 (BMC/Redfish)",
        "용량 12개월 예측 + PDF 리포트 자동 생성",
        "알림 엔진 5분 주기 자동 평가 + 만료 D-day 추적",
    ])

# --- Before/After 인포그래픽 ---
make_before_after_slide(
    "Before → After — 무엇이 달라졌나",
    [
        ("모니터링: Grafana 대시보드 10개+ 산재 (서버 1대에 3~4개 이동)", "통합 대시보드 — 서버 클릭 1번에 전체 지표"),
        ("자산 관리: 엑셀 수기 대장 (버전 혼란·이력 없음)", "DB 기반 CRUD + 라이프사이클 + 변경 이력 자동"),
        ("물리 배치: 담당자 기억·종이 도면", "Digital Twin 평면도 + 랙 열지도"),
        ("장비 등록: 한 대씩 타이핑 (24대 반나절)", "CSV 일괄 + Prometheus 자동 탐지 (~30분)"),
        ("전원 제어: 서버별 IPMI 개별 접속", "웹에서 원격 전원 제어 (BMC/Redfish)"),
        ("용량 계획: 감(感) 의존·수기 보고", "12개월 예측 + PDF 리포트 자동 생성"),
    ],
    subtitle="10개+ 도구·엑셀·수기로 흩어진 운영 → 통합 웹 시스템 한 곳")

# --- KPI 빅넘버 타일 ---
make_kpi_slide(
    "한눈에 보는 규모",
    [
        ("4.5", "개발 기간(개월)"),
        ("1+AI", "개발 인력(명)"),
        ("580+", "커밋 (99%+ AI)"),
        ("44K+", "소스 코드(줄)"),
        ("74", "API 엔드포인트"),
        ("39", "화면(페이지)"),
        ("135", "구현 기능"),
        ("29", "DB 모델"),
    ],
    subtitle="인프라 엔지니어 1명 + AI가 4.5개월에 만든 결과물 (정확 수치는 docs/stats.md)")

make_table_slide("핵심 수치 (2026-07-02 감사 시점 기준)",
    ["항목", "수치", "항목", "수치"],
    [
        ["개발 기간", "4.5개월 (실질 2.5개월)", "총 커밋", "576개 (AI 작성 99%+)"],
        ["개발 인력", "1명 (인프라 엔지니어) + AI", "소스 코드", "44,211줄 / 218개 파일"],
        ["페이지/화면", "39개", "API 엔드포인트", "74개"],
        ["구현 기능", "135개 (12개 카테고리)", "DB 모델", "29개 (Prisma)"],
        ["다국어", "한/영 511개 번역 키", "산출물 문서", "40여 개 (매뉴얼·UML·ERD 포함)"],
    ],
    col_widths=[2.6, 3.4, 2.6, 3.4],
    footnote="기술 스택: Next.js 14 + TypeScript + Prisma + PostgreSQL + Prometheus 연동, SSE 실시간, Docker/systemd 하이브리드 운영 (폐쇄망)")

# --- 8단계 진화 타임라인 ---
make_timeline_slide(
    "4.5개월의 여정 — 8단계 진화",
    [
        (1, "스캐폴딩", "4/8"),
        (2, "Docker 삽질", "4/9"),
        (3, "기능 폭발", "4/10~20"),
        (4, "실데이터 고통", "4말~5중"),
        (5, "규칙 정립", "5월"),
        (6, "고도화", "6월"),
        (7, "문서화", "6/16~17"),
        (8, "품질 감사·도구화", "6/22~25"),
    ],
    subtitle="빠르게 만들고(3) → 실환경에서 깨지고(4) → 규칙으로 압축하고(5) → 도구화(8). 실패가 규칙·도구가 된 과정")

# ==================== §2 AI 활용 방법 ====================
make_section_slide("AI 활용 방법", "구현 · 병렬 감사 · 문서 생성 · 운영 지원", 1)

make_table_slide("AI 활용 유형 4가지 — 전 과정에 걸친 협업",
    ["유형", "실제 활용", "규모·성과"],
    [
        ["① 코드 구현", "기능 구현·수정·디버깅 전담. 스캐폴딩(구조+스키마+핵심 화면)은 하루 만에", "커밋 99%+ AI 작성 · 하루 9~13개 항목 완료 사례 (work-log 실기록)"],
        ["② 병렬 에이전트 감사", "AI 8명이 레이어(API·인증·보안·동시성 등)를 나눠 동시 조사 → 교차 검증", "릴리즈 전 이슈 65건+ 발견 (§5 상세)"],
        ["③ 문서·발표자료 생성", "코드를 직접 읽고 매뉴얼·UML·ERD·보고서·PPT 생성", "매뉴얼 805줄 · PPT 56슬라이드 · 주간보고 자동화 스킬"],
        ["④ 운영 지원", "백업·복구·로그로테이션 스크립트, 장애 진단, DB 장애 복구 주도", "진단 스크립트 116+개 · DB 장애 데이터 손실 0 복구"],
    ],
    col_widths=[2.2, 5.4, 4.4], font_pt=12, row_h=0.8)

make_table_slide("병렬 에이전트 감사 — “AI가 AI를 검증한다” (실사례)",
    ["시점", "감사", "결과"],
    [
        ["06-25", "8-에이전트 사전 코드리뷰 (Bulk HW Refresh)", "서버 실행 전 버그 6건 일괄 발견 (트랜잭션 누락 등) — 단독 리뷰면 1~2건 수준"],
        ["06-29", "8-에이전트 종합 소스 감사 (8영역 전수)", "40여 이슈 발견 — 권한 우회(비소속 운영자가 전원 리셋 가능) 등 즉시 수정"],
        ["06-29", "8-에이전트 장애 진단 (운영 DB 중단)", "배포 구조 규명 → 볼륨 보존 확인 → 데이터 손실 0 복구"],
        ["06-30", "v0.9 적대적 검증 (2차 감사)", "확정 버그 수정 + 미해결 건은 '알려진 이슈'로 정직하게 문서화"],
        ["07-02", "4-에이전트 산출물 감사 + UML 설계 추적", "설계 허점 19건 발견, 보안 5건 당일 수정"],
        ["상시", "팀A/팀B 설계 토론 (찬성 vs 리스크 2관점)", "설계 판단마다 코드 근거 기반 토론 후 결정 — 에이전트 파일로 도구화"],
    ],
    col_widths=[1.4, 4.6, 6.0], font_pt=11, row_h=0.72)

make_content_slide("협업 방법론 — 프롬프트 → 규칙 → 도구, 3단계 진화", [
    "1단계 프롬프트 (4~5월): 매번 말로 지시 → 실데이터와 충돌, Prometheus/BMC 연동에만 78+회 수정",
    "2단계 규칙 (5월~): 실패할 때마다 CLAUDE.md에 재발 방지 규칙 축적 — “규칙 = 실패의 압축”",
    "  Data-First(추측 코딩 금지) · 변경영향분석 · 중복구현 방지 · 검증 루틴 · 팀A/B 토론 · 폐쇄망 제약 — 6대 규칙 전부 실제 사고에서 탄생",
    "3단계 도구화 (6월~): “세 번 반복한 프롬프트는 자산화 신호”",
    "  서브에이전트 3종(팀A·팀B·영향분석) + 스킬(데이터 확인·문서 동기화·주간보고) + 훅(세션 시작 자동 준비, 스키마 수정 즉시 자동 검증)",
    "역할 분담: 사람 = 기획·방향·실환경 테스트·“막다른 길” 판단  /  AI = 코드·디버깅·문서·병렬 감사",
    "  핵심: “에러 고쳐줘”(증상)가 아니라 “실패 가능한 모든 경로를 조사해줘”(구조)라고 묻는 것 — 질문의 범위가 결과를 바꾼다",
])

make_two_col_slide("폐쇄망 제약 극복 — Data-First 방법론",
    "제약: 실데이터를 AI가 볼 수 없다", [
        "폐쇄망 — 파일 반출·클립보드 복사 불가",
        "사용자가 화면을 보고 손으로 타이핑해 전달",
        "디버깅 1사이클 30분~1시간 (일반 환경 5분)",
        "초기: 추측 코딩 → 실데이터에서 전부 실패",
        "  Prometheus 쿼리 재작업만 78+회 (4~5월)",
    ],
    "해법: 확인 → 기록 → 구현 3단 원칙", [
        "① AI가 확인 스크립트 작성 (116+개) — 출력 극단 최소화 (한 줄 요약, 샘플 1개)",
        "② 받은 데이터는 파일로 영구 기록 (31건) — 같은 데이터 재요청 금지",
        "③ 실데이터 확인 후에만 코드 작성",
        "효과: 규칙 정착 후 수정 커밋 비율 절반으로 감소 (§5)",
        "이 원칙 자체를 스킬로 도구화 — 규칙이 잊히지 않음",
    ])

# ==================== §3 비용·기간 단축 ====================
make_section_slide("개발 비용·기간 단축 효과", "기능점수(FP) · 맨먼스 기준 산정", 2)

make_table_slide("1인+AI vs 외주 개발 — 정량 비교",
    ["지표", "외주 개발 (추정)", "1인 + AI (실제)", "차이"],
    [
        ["규모 산정", "기능점수 약 700 FP", "동일 산출물 기준", "—"],
        ["투입 인력", "3~4명 팀 (PL·백엔드·프론트·QA)", "1명 (인프라 엔지니어, 웹 비전공)", "—"],
        ["투입 공수", "25~35 맨먼스", "4.5 맨먼스", "약 6~8배"],
        ["개발 기간", "6~9개월", "4.5개월 (실질 2.5개월)", "약 1.5~2배 단축"],
        ["총 비용", "3.5~5.5억 원 (SW사업 대가 기준)", "약 4,500만 원 (인건비+AI 구독)", "약 8~11배 절감"],
        ["인당 생산성", "약 20 FP/MM", "약 155 FP/MM", "약 7~8배"],
    ],
    col_widths=[2.2, 3.9, 3.9, 2.0],
    footnote="※ 개략 산정 — 공식 IFPUG 계수·정부 대가산정 아님. 외주에는 QA·문서·하자보수가 포함되어 동일 조건 비교가 아님 (상세 전제: docs/cost-comparison-20260630.md)")

# --- 차트 1: 개발 기간 (인력 투입 방식별) — 핵심 시각화 ---
make_chart_slide(
    "개발 기간 비교 — 인력 투입 방식별",
    ["1명\n(AI 없이)", "2명 팀", "3명 팀", "4명 팀", "1명 + AI\n(실제)"],
    [28, 14, 9, 7, 4.5],
    chart_type="column",
    highlight_idx=4,
    value_labels=["~28개월", "~14개월", "~9개월", "~7개월", "4.5개월"],
    subtitle="같은 결과물(약 700 FP)을 만드는 데 걸리는 기간. 인원이 줄수록 겸업으로 기간↑ — 그런데 1명+AI가 팀보다 빠름",
    footnote="※ 외주 맨먼스(약 28MM) 기준 인원별 환산. 1명(AI 없이)은 순수 1인 환산치(≈2.5~3년). 개략 추정.")

# --- 차트 2: 총 비용 ---
make_chart_slide(
    "총 비용 비교 — 외주(팀) vs 1인+AI",
    ["외주 개발\n(팀 3~4명)", "1인 + AI\n(실제)"],
    [45000, 4500],
    chart_type="bar",
    highlight_idx=1,
    value_labels=["약 3.5~5.5억 원", "약 4,500만 원"],
    subtitle="단위: 만원 · 약 8~11배 절감",
    footnote="※ 외주는 SW사업 대가/맨먼스 기준 추정, QA·문서·하자보수 포함. 1인+AI는 내부 인건비+AI 구독. 동일 조건 비교 아님.")

# --- 차트 3: 인당 생산성 ---
make_chart_slide(
    "인당 생산성 — 외주 vs 1인+AI",
    ["외주 개발", "1인 + AI"],
    [20, 155],
    chart_type="column",
    highlight_idx=1,
    value_labels=["~20 FP/MM", "~155 FP/MM"],
    subtitle="맨먼스당 기능점수(FP/MM) · 약 7~8배",
    footnote="※ FP는 구조 기반 개략 추정. '역량 있는 개발자 + AI' 전제(AI ≠ 완전 자동).")

# --- 차트: 월별 커밋 추이 (개발 속도) ---
make_chart_slide(
    "개발 속도 — 월별 커밋 수 (git 실측)",
    ["2월", "4월", "5월", "6월", "7월"],
    [1, 102, 165, 303, 18],
    chart_type="column",
    highlight_idx=3,
    value_labels=["1", "102", "165", "303", "18"],
    subtitle="스캐폴딩(2월) → 기능 폭발기(4~6월 가속) → 릴리즈 후 안정화(7월). 커밋의 99%+를 AI가 작성",
    footnote="※ 3월은 커밋 없음(공백). 7월은 v0.9 릴리즈 후 안정화·문서 정비 기간이라 감소.")

make_content_slide("기간·비용의 의미 — 세 가지 환산", [
    "가장 강력한 비교: 같은 1명이 AI 없이 개발하면 약 2.5~3년 → AI와 함께 4.5개월",
    "팀 환산: 1인+AI의 산출량이 외주 3~4인 팀 수준 — 개발 속도 피크 주 81커밋, 주 평균 약 42커밋 (git 실측)",
    "문서까지 포함: 사용자 매뉴얼(805줄)·장애 대응서 20종·발표 PPT 56슬라이드 — 통상 2~4주 분량을 수일 내 생성 (추정)",
    "",
    "발표 시 유의 (정직성 원칙):",
    "  실측(커밋·코드·기능 수)과 추정(FP·비용·기간)을 구분해 표기",
    "  “AI가 99% 작성” ≠ 자동 — 요건 정의·도메인 판단·실환경 검증은 사람의 몫 (역량 있는 운전자 전제)",
])

# ==================== §4 업무 자동화·생산성 ====================
make_section_slide("업무 자동화·생산성 향상", "사람이 하던 일 → 시스템이 하는 일", 3)

make_table_slide("업무 자동화 Before → After (9개 항목)",
    ["업무", "Before (수작업)", "After (DC Express)", "주간 절감(추정)"],
    [
        ["서버 상태 점검", "대시보드 10개+ 순회 (~15분)", "서버 클릭 1번 통합 뷰 (~2분)", "~2.2시간"],
        ["장애 초동 분석", "알림→대시보드→IPMI 별도 접속 (~30분)", "한 화면에서 센서·전원까지 (~10분)", "~0.7시간"],
        ["장비 입고 등록", "엑셀+스펙 조사, 24대=반나절", "CSV 일괄+자동탐지+BMC 수집 = ~30분", "~0.9시간"],
        ["자산 조회·갱신", "엑셀 최신본 찾기 (~10분)", "DB 즉시 검색+이력 자동 (~1분)", "~1.5시간"],
        ["원격 전원 제어", "서버별 IPMI 접속 (~10분/대)", "웹 클릭 (~1분)", "~0.75시간"],
        ["분기 용량 보고", "수동 집계+작성 = 반나절", "예측 대시보드+PDF 자동 = ~5분", "~0.3시간"],
        ["이상 감시", "사람이 봐야 발견 (감시 공백)", "알림 엔진 5분 주기 24×7 자동", "(정성: 무인화)"],
        ["만료 관리", "체계적 추적 부재", "D-day 자동 추적+알림", "(정성: 누락 제거)"],
        ["백업·로그", "수동/부재", "매일 자동 백업+로그로테이션", "~0.5시간"],
    ],
    col_widths=[2.0, 3.7, 3.9, 2.4], font_pt=10, row_h=0.5,
    footnote="※ 절감 = 빈도 × 건당 시간차. 빈도는 운영 경험 기반 보수적 가정(실측 아님). 정성 효과(24×7 감시·감사 추적)는 시간 환산 제외")

make_content_slide("자동화·생산성 — 종합", [
    "반복 운영업무 절감: 주 약 8~10시간 → 연 400시간 이상 (약 0.2 FTE, 하한 추정)",
    "  + 시간으로 환산하지 않은 것: 24×7 무인 감시(감시 공백 제로화), 만료 누락 리스크 제거, 전 변경의 감사 추적",
    "",
    "기억할 세 가지 수치 (문서에 기록된 실사용 비교):",
    "  장비 24대 입고 등록: 반나절 → 30분",
    "  분기 용량 보고서: 반나절 → 5분",
    "  1인 단독 개발이라면: 2.5~3년 → (AI와) 4.5개월",
    "",
    "개발 생산성: 1인이 39화면·74 API·135기능 — 문서·발표자료(매뉴얼 805줄, PPT 56슬라이드)까지 AI가 코드를 읽고 직접 생성",
])

# --- 장비 라이프사이클 플로우 ---
make_flow_slide(
    "자동화 사례 — 장비 라이프사이클 관리",
    ["등록\n(PLANNED·입고)", "설치\n(INSTALLED)", "운영\n(ACTIVE)", "유지보수·수리\n(MAINT·REPAIR)", "퇴역·폐기\n(DECOMM·DISPOSED)"],
    subtitle="엑셀 수기 대장 → 시스템이 상태 전이를 관리. 모든 변경은 감사 로그(누가·언제·왜)에 자동 기록",
    note="※ 실제 상태는 9단계(PLANNED·RECEIVING·INSTALLED·ACTIVE·MAINTENANCE·REPAIR·FAILED·DECOMMISSIONED·DISPOSED)이며, 위는 발표용 5단계 요약. 각 전이 시 알림·감사 자동 처리.")

# ==================== §5 품질 개선 ====================
make_section_slide("에러 감소·품질 개선", "결함이 사용자에게 닿기 전에 잡는 다층 방어", 4)

make_content_slide("품질 체계 — 3층 방어", [
    "핵심 프레임: “에러가 없었다”가 아니라 — “결함이 사용자에게 닿기 전에 잡히는 체계를 AI로 구축했다”",
    "",
    "1층 — 규칙: CLAUDE.md 6대 규칙 (전부 실제 실패에서 탄생한 재발 방지책)",
    "  팀A/B 토론 · 중복확인 · 변경영향분석 · 검증루틴 · Data-First · 폐쇄망 제약",
    "2층 — 자동 게이트: 매 작업마다 기계적으로 실행",
    "  typecheck + lint + 62개 테스트 (verify) · 빌드 검증 (verify:full) · 스키마 수정 즉시 자동 검증(훅)",
    "3층 — AI 다중 관점 감사: 릴리즈·난제 앞에서 에이전트 4~8명이 레이어를 나눠 교차 검증",
    "  8-에이전트 소스 감사 · 적대적 검증 · UML 설계 추적 감사",
])

make_content_slide("실증 ① — 릴리즈 전에 잡은 결함 65건+", [
    "8-에이전트 사전 코드리뷰: 서버 실행 전 버그 6건 일괄 발견 — 단독 리뷰였으면 1~2건 수준",
    "8-에이전트 종합 감사: 40여 이슈 — 최고 심각도는 권한 우회(비소속 운영자가 서버 전원 리셋·메모리 정보 변조 가능) → 전 라우트 정책 통일",
    "UML 설계 추적 감사: 다이어그램을 그리려 코드를 역추적하는 과정 자체가 설계 허점 19건을 드러냄 → 보안 5건 당일 수정",
    "  “UML은 그림이 아니라 감사 도구였다”",
    "합계: 이슈 65건+ 선제 발견, 그중 보안·권한 우회 7건 수정 — 전부 파일:라인 근거와 함께 문서화 (검증 가능한 기록)",
    "",
    "운영 장애 대응: 운영 DB 중단 사고 → 8-에이전트 진단으로 데이터 손실 0 복구 + 재발 방지 명문화",
])

make_table_slide("실증 ② — 월별 수정(fix) 커밋 비율 추이 (git 실측)",
    ["월", "전체 커밋", "fix", "비율", "해석"],
    [
        ["4월", "102", "39", "38.2%", "추측 코딩의 대가 — 실데이터 고통기"],
        ["5월", "165", "29", "17.6%", "Data-First 규칙 정착 → 절반 이하로 감소"],
        ["6월", "303", "64", "21.1%", "반등은 퇴보가 아니라 릴리즈 전 의도된 버그 사냥 (감사 배치 수정)"],
        ["7월", "11", "1", "9.1%", "릴리즈 후 안정화"],
    ],
    col_widths=[1.2, 1.8, 1.4, 1.6, 6.0],
    footnote="※ 스토리: 규칙 도입으로 fix 반토막(38→18%) → 6월 반등은 자체 감사가 선제 발견한 수정 (커밋명 'Fix audit findings batch 1~5'가 증거) → 7월 9%")

# --- 차트 4: 월별 fix 비율 추세 ---
make_chart_slide(
    "월별 수정(fix) 커밋 비율 추이",
    ["4월", "5월", "6월", "7월"],
    [38.2, 17.6, 21.1, 9.1],
    chart_type="line",
    value_labels=["38.2%", "17.6%", "21.1%", "9.1%"],
    subtitle="Data-First 규칙 도입 후 반토막(4→5월). 6월 반등은 릴리즈 전 '의도된 버그 사냥'. 단위: %",
    footnote="※ git 실측(전체 586커밋 중 fix 133건=약 23%). 6월 반등분 상당수는 사용자 신고가 아닌 자체 감사가 선제 발견·수정한 것.")

# --- 도넛: 커밋 유형 구성비 ---
make_pie_slide(
    "커밋 유형 구성비 — '만들고 → 고치는' 리듬 (git 실측)",
    ["기능 추가 (feat/add)", "수정 (fix)", "문서 (docs)", "기타 (chore·refactor·test 등)"],
    [256, 133, 51, 146],
    subtitle="fix가 약 23% — '빠르게 만들고 실환경에서 고친다'는 바이브 코딩의 정직한 현실. 숨기지 않고 공개",
    footnote="※ 커밋 제목 접두사 기준 분류. 리팩터링(refactor)은 3건뿐 → 향후 테스트·리팩터링 투자 필요(정직한 한계).")

make_two_col_slide("정직한 한계와 다음 투자",
    "한계 (스스로 계량해 공개)", [
        "API 라우트 74개 중 테스트 1개 (1.4%)",
        "화면 렌더링 테스트 0개, E2E 1스펙",
        "권한 우회 결함도 이 무테스트 공백에서 발생",
        "리팩터링 3건 — 기능 속도 우선의 대가",
        "발표 팁: 한계를 먼저 말하면 질의응답에서 방어할 필요가 없다",
    ],
    "v1.0 투자 계획 (위험도순)", [
        "① RBAC 권한 게이트 테스트 (보안 직결)",
        "② 알림 엔진 상태 전이 테스트",
        "③ 전원 제어 흐름 테스트 (장비 오정지 방지)",
        "이월 보안 항목: 알림 조직 필터(S3) 등 — 사유까지 문서화 완료",
        "실패→규칙→도구 선순환 지속 (예: DB 사고 → 위험 명령 차단 훅)",
    ])

# ==================== §6 운영 계획 ====================
make_section_slide("향후 운영 계획", "이미 갖춰진 체계 + 신규 과제 7건", 5)

make_table_slide("운영 체계 — 대부분 이미 문서·스크립트로 구축됨",
    ["영역", "현행 (구축 완료)", "신규 과제"],
    [
        ["정기 점검", "일/주/월 체크리스트 문서화 (헬스·백업·디스크·타겟·커넥션)", "원커맨드 일일점검 스크립트"],
        ["장애 대응", "시나리오 20종+엣지 6종 매뉴얼, P0~P3 등급(15분~당일), 대화형 복구 도구, 에스컬레이션 4단계", "장애 기록 대장, 절차 일부 현행화"],
        ["백업·복구", "매일 03:00 자동 백업(7일 보관)+사전백업 복원 절차+로그로테이션", "2차 위치(NFS)·장기 보관·분기 복원 리허설"],
        ["릴리즈", "v0.9 확정(PR 머지+현장 검증) → v1.0(보안 이월+알려진 이슈 3건+테스트 보강)", "—"],
        ["사용자 지원", "매뉴얼 PPT 56슬라이드·사용 가이드 문서", "앱 내 피드백 접수(버그/요청/정정 3분류)"],
        ["1인 운영 리스크", "인수인계 문서 체계(핸드오버·문서지도·장애 매뉴얼)", "백업 담당자 1명 지정+30분 교육"],
    ],
    col_widths=[1.8, 6.0, 4.2], font_pt=11, row_h=0.72)

make_content_slide("릴리즈 로드맵", [
    "즉시 — v0.9 확정: PR 머지 + 보안 수정분 현장 검증 + 알림 cron 등록 확인",
    "v1.0 (다음 단계): 보안 이월(알림 조직 필터, PromQL 화이트리스트) + 권한 정합성·알림 엔진 관측성 개선(S6~S19)",
    "  + 알려진 이슈 3건 (차트 다중 시계열 · 랙 위치 충돌 검증 · 알림 지속시간 조건)",
    "  + 테스트 보강 (RBAC → 알림 → 전원 순, 위험도 기준)",
    "운영 원칙: 폐쇄망 특성상 모든 복구 절차는 로컬 완결형 유지, 배포는 파일 복사 방식",
    "",
    "상세: docs/operations-plan.md (공청회 배포용 전문)",
])

# ==================== §7 혁신 방향성 ====================
make_section_slide("AI 기반 업무 혁신 방향성", "한 사람의 사례에서 조직의 역량으로", 6)

make_content_slide("이 사례가 증명한 것 — 타 업무 적용 시사점 3가지", [
    "① 규칙 문서(CLAUDE.md)는 “팀의 실패 로그 압축판”으로 시작하라",
    "  6개 규칙 전부가 실제 사고에서 탄생 — 템플릿 복사로 시작하면 시행착오 비용이 사라진다",
    "② 세 번 반복한 프롬프트는 파일(에이전트·스킬·훅)로 만들어라",
    "  규칙은 잊히지만 도구는 잊지 않는다 — 말로 못 막은 사고를 훅은 100% 차단",
    "  “바이브 코딩의 다음 단계는 프롬프트 엔지니어링이 아니라 워크플로 엔지니어링”",
    "③ AI 산출물은 AI 병렬 감사로 검증하되, 방향 판단은 사람이 하라",
    "  단독 리뷰 1~2건 vs 8-에이전트 레이어 분담 6~40건 — 단, “막다른 길” 판단은 사람만 가능",
])

make_two_col_slide("조직 확산 제안",
    "적용 영역 가이드", [
        "적합: 내부 관리 도구, 대시보드, PoC, 반복 문서 작업 — 도메인 전문가가 직접 만드는 경우",
        "부적합: 고객 대면 서비스, 고가용성 프로덕션, 보안 최상위 시스템",
        "필수 조건 4가지:",
        "  규칙 체계(CLAUDE.md) · Data-First 원칙",
        "  도메인 지식 감독자 · 단일 진실 공급원 문서",
    ],
    "확산 로드맵 (제안)", [
        "1단계: 본 사례 템플릿 패키지화 — 규칙·에이전트·스킬·훅을 복사 가능한 형태로",
        "2단계: 파일럿 1~2개 부서 적용 (내부 도구·자동화부터)",
        "3단계: 사내 가이드·교육 (반나절 과정: 규칙 작성법 + 검증 루틴 + 병렬 감사)",
        "다음 프로젝트 개선안은 이미 문서화 완료 — 훅 강제·브라우저 검증·플랜 모드·MCP 연동 (docs/next-project-ai-workflow.md)",
    ])

make_quote_slide("버그가 없는 소프트웨어는 없습니다. 차이는 ‘누가 먼저 찾느냐’입니다. 우리는 AI에게 먼저 찾게 했습니다.",
                 "— DC Express 프로젝트, 그리고 다음 프로젝트를 향해")

# --- 마지막: Q&A ---
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide)
add_accent_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.06), ACCENT_BLUE)
add_text_box(slide, Inches(1.5), Inches(2.8), Inches(10), Inches(1),
             "감사합니다 — Q&A", font_size=44, color=ACCENT_BLUE, bold=True)
add_text_box(slide, Inches(1.5), Inches(4.0), Inches(10), Inches(0.6),
             "상세 산출물: 결과보고서 · 비용 비교 · UML/ERD · 운영 계획 · 다음 프로젝트 개선안 (docs/INDEX.md)",
             font_size=15, color=TEXT_SECONDARY)
add_accent_bar(slide, Inches(0), Inches(7.38), SLIDE_W, Inches(0.06), ACCENT_BLUE)

# === Save ===
import os
out = os.path.join(os.path.dirname(__file__), "..", "docs", "DC_Express_AI_Innovation_Report.pptx")
prs.save(out)
print(f"Saved: {out}")
print(f"Total slides: {len(prs.slides)}")
