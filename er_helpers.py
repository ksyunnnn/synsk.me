import sys

INK = "#2d3142"
MUTED = "#4f5d75"
ACCENT = "#bf4520"
PAPER = "#f5f5f5"
MONO = "'Geist Mono', 'Hiragino Kaku Gothic ProN', monospace"
SANS = "'Geist', 'Hiragino Kaku Gothic ProN', sans-serif"


def entity(x, y, w, name, fields, focal=False):
    h = 60 + len(fields) * 20
    out = []
    if focal:
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="rgba(191,69,32,0.04)" stroke="{ACCENT}" stroke-width="1"/>')
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="40" rx="6" fill="rgba(191,69,32,0.10)"/>')
        out.append(f'<rect x="{x}" y="{y + 32}" width="{w}" height="8" fill="rgba(191,69,32,0.10)"/>')
        out.append(f'<line x1="{x}" y1="{y + 40}" x2="{x + w}" y2="{y + 40}" stroke="rgba(191,69,32,0.40)" stroke-width="1"/>')
        tag_fill = ACCENT
    else:
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="#ffffff" stroke="{INK}" stroke-width="1"/>')
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="40" rx="6" fill="rgba(45,49,66,0.04)"/>')
        out.append(f'<rect x="{x}" y="{y + 32}" width="{w}" height="8" fill="rgba(45,49,66,0.04)"/>')
        out.append(f'<line x1="{x}" y1="{y + 40}" x2="{x + w}" y2="{y + 40}" stroke="rgba(45,49,66,0.22)" stroke-width="1"/>')
        tag_fill = MUTED
    out.append(f'<text x="{x + 16}" y="{y + 16}" fill="{tag_fill}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">TABLE</text>')
    out.append(f'<text x="{x + 16}" y="{y + 32}" fill="{INK}" font-size="14" font-weight="600" font-family="{SANS}">{name}</text>')
    for i, (fname, ftype, hl) in enumerate(fields):
        fy = y + 60 + i * 20
        color = ACCENT if hl else INK
        weight = ' font-weight="600"' if hl else ""
        out.append(f'<text x="{x + 16}" y="{fy}" fill="{color}" font-size="10" font-family="{MONO}"{weight}>{fname}</text>')
        out.append(f'<text x="{x + w - 16}" y="{fy}" fill="{MUTED}" font-size="10" font-family="{MONO}" text-anchor="end">{ftype}</text>')
    return out


def label(cx, y_top, text, accent=False):
    w = 12 if len(text) == 1 else 28
    color = ACCENT if accent else MUTED
    return [
        f'<rect x="{cx - w / 2}" y="{y_top}" width="{w}" height="12" rx="2" fill="{PAPER}"/>',
        f'<text x="{cx}" y="{y_top + 10}" fill="{color}" font-size="10" font-family="{MONO}" text-anchor="middle" font-weight="600">{text}</text>',
    ]


def path(d, accent=False):
    color = ACCENT if accent else MUTED
    width = "1.5" if accent else "1"
    return [f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}"/>']


def legend(h):
    y = h - 56
    return [
        f'<line x1="40" y1="{y}" x2="920" y2="{y}" stroke="rgba(45,49,66,0.10)" stroke-width="0.8"/>',
        f'<text x="40" y="{y + 16}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.18em">LEGEND</text>',
        f'<rect x="40" y="{y + 30}" width="14" height="10" rx="2" fill="rgba(191,69,32,0.04)" stroke="{ACCENT}" stroke-width="1"/>',
        f'<text x="60" y="{y + 38}" fill="{MUTED}" font-size="9" font-family="{SANS}">テーマのために変えたところ</text>',
        f'<text x="200" y="{y + 38}" fill="{INK}" font-size="10" font-family="{MONO}" font-weight="600">#</text>',
        f'<text x="214" y="{y + 38}" fill="{MUTED}" font-size="9" font-family="{SANS}">主キー</text>',
        f'<text x="272" y="{y + 38}" fill="{INK}" font-size="10" font-family="{MONO}" font-weight="600">→</text>',
        f'<text x="288" y="{y + 38}" fill="{MUTED}" font-size="9" font-family="{SANS}">ほかの表を指す列</text>',
        f'<text x="400" y="{y + 38}" fill="{MUTED}" font-size="10" font-family="{MONO}" font-weight="600">0..1 / 0..N / 1..N</text>',
        f'<text x="516" y="{y + 38}" fill="{MUTED}" font-size="9" font-family="{SANS}">線の端の表が、相手 1 行に対して何行つくか</text>',
    ]


CAREER = [("# id", "integer", False)]
PROJECT = [("# id", "integer", False), ("→ career_id", "integer", False), ("slug", "text · unique", False)]
REVISION = [("# id", "integer", False), ("→ note_id", "integer", False), ("title", "text", False), ("body", "text", False)]
SYND = [("→ note_id", "integer", False), ("url", "text", False)]
ACT_BASE = [
    ("# id", "integer", False), ("platform", "text", False), ("kind", "text", False),
    ("title", "text", False), ("url", "text", False), ("published_at", "text", False),
    ("visibility", "text", False), ("→ project_id", "integer", False),
]
NOTE_BASE = [
    ("# id", "integer", False), ("slug", "text · unique", False), ("status", "text", False),
    ("→ published_revision_id", "integer", False), ("published_at", "text", False),
]


