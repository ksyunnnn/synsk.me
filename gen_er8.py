import sys

from er_helpers import INK, MUTED, PAPER, MONO, SANS, label, path

W = 1740
H = 1544


def entity(x, y, w, name, purpose, fields, kind="TABLE"):
    h = 76 + len(fields) * 20
    out = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="#ffffff" stroke="{INK}" stroke-width="1"/>',
        f'<rect x="{x}" y="{y}" width="{w}" height="56" rx="6" fill="rgba(45,49,66,0.04)"/>',
        f'<rect x="{x}" y="{y + 48}" width="{w}" height="8" fill="rgba(45,49,66,0.04)"/>',
        f'<line x1="{x}" y1="{y + 56}" x2="{x + w}" y2="{y + 56}" stroke="rgba(45,49,66,0.22)" stroke-width="1"/>',
        f'<text x="{x + 16}" y="{y + 16}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">{kind}</text>',
        f'<text x="{x + 16}" y="{y + 32}" fill="{INK}" font-size="14" font-weight="600" font-family="{SANS}">{name}</text>',
        f'<text x="{x + 16}" y="{y + 47}" fill="{MUTED}" font-size="9" font-family="{SANS}">{purpose}</text>',
    ]
    for i, (fname, ftype) in enumerate(fields):
        fy = y + 76 + i * 20
        out.append(f'<text x="{x + 16}" y="{fy}" fill="{INK}" font-size="10" font-family="{MONO}">{fname}</text>')
        out.append(f'<text x="{x + w - 16}" y="{fy}" fill="{MUTED}" font-size="10" font-family="{MONO}" text-anchor="end">{ftype}</text>')
    return out


def zone(x, y, w, h, name):
    return [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(45,49,66,0.03)" stroke="rgba(45,49,66,0.18)" stroke-width="1" stroke-dasharray="4,3"/>',
        f'<text x="{x + 16}" y="{y + 24}" fill="{MUTED}" font-size="11" font-weight="600" font-family="{SANS}">{name}</text>',
    ]


def rel_label(cx, y_top, text):
    w = len(text) * 6 + 12
    return [
        f'<rect x="{cx - w / 2}" y="{y_top}" width="{w}" height="12" rx="2" fill="{PAPER}"/>',
        f'<text x="{cx}" y="{y_top + 9}" fill="{MUTED}" font-size="8" font-family="{MONO}" text-anchor="middle" letter-spacing="0.12em">{text}</text>',
    ]


def kinds_note(x, y):
    rows = [
        ("外部の項目", "zenn など", "article", "external_id"),
        ("life event", "life_event", "life_event", "id"),
        ("想定外のサイト", "unlisted", "article", "url"),
    ]
    w, h = 340, 60 + len(rows) * 20 + 72
    out = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="#ffffff" stroke="{MUTED}" stroke-width="1" stroke-dasharray="4,3"/>',
        f'<text x="{x + 16}" y="{y + 20}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">NOTE</text>',
        f'<text x="{x + 16}" y="{y + 36}" fill="{INK}" font-size="12" font-weight="600" font-family="{SANS}">activity の行の種類（source）</text>',
    ]
    cols = [x + 16, x + 96, x + 168, x + 248]
    for cx, t in zip(cols, ["行", "source", "kind", "同一性"]):
        out.append(f'<text x="{cx}" y="{y + 56}" fill="{MUTED}" font-size="9" font-family="{SANS}">{t}</text>')
    for i, row in enumerate(rows):
        ry = y + 76 + i * 20
        for j, (cx, t) in enumerate(zip(cols, row)):
            font = SANS if j == 0 else MONO
            out.append(f'<text x="{cx}" y="{ry}" fill="{INK}" font-size="10" font-family="{font}">{t}</text>')
    out.append(f'<text x="{x + 16}" y="{y + 76 + len(rows) * 20 + 4}" fill="{MUTED}" font-size="9" font-family="{SANS}">source の値と kind は activity_source に持ち、外部キーで指す</text>')
    out.append(f'<text x="{x + 16}" y="{y + 76 + len(rows) * 20 + 20}" fill="{MUTED}" font-size="9" font-family="{SANS}">行の種類ごとの決まり（url・happened_on の有無）は CHECK で守る</text>')
    out.append(f'<text x="{x + 16}" y="{y + 76 + len(rows) * 20 + 36}" fill="{MUTED}" font-size="9" font-family="{SANS}">note・project・career は activity に行を持たず、ビューでつなぐ</text>')
    return out


def rules_note(x, y):
    lines = [
        "外部キーはすべて NO ACTION。物理削除のときは子の行を先に消す。外部キーの子の列には索引を張る",
        "互いを指す外部キー（note.published_revision_id・*.card_media_id）は、検査をトランザクションの終わりに送る（DEFERRABLE）",
        "created_at・updated_at は DB が既定値で入れ、updated_at は行を書き換えたときにトリガーが入れ直す",
        "activity_feed のビューは、並べる列を UI で決めてから作る",
        "CHECK の値: *.status は draft・published。resume.audience は limited・public。project.kind は application・talk・event・other",
        "CHECK の値: activity_source.kind は article・life_event。note.card_image は generated・media・site",
        "年月・日付の列は、形と「終わり ≥ 始まり」を CHECK で守る",
        "*.card_media_id と note.published_revision_id は、複合の外部キーで同じ持ち主の行だけを指す",
        "media は、持ち主の列（note_id・project_id・career_id・activity_id）のちょうど 1 つが入る（CHECK）",
        "note.status が公開なら、note.published_revision_id と note.published_at は空でない（CHECK）",
        "resume: 公開用は 1 つだけ（部分 UNIQUE 索引）。公開用は鍵と期限を持たない（CHECK）。audience の更新はトリガーで拒む",
        "activity: UNIQUE(source, external_id)。external_id が空の行は UNIQUE(source, url)",
        "activity.sort_at は published_at か happened_on から求め、NOT NULL",
        "skill.name は COLLATE NOCASE（大文字と小文字を区別しない）",
        "id はすべて AUTOINCREMENT（削除した id を使い回さない）。編集の画面は id で行を指すため",
        "訪問者の URL は slug、R2 は storage_key で指す。R2 のバケットは公開せず、Worker を通して配る",
    ]
    w, h = 720, 48 + len(lines) * 18 + 8
    out = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="#ffffff" stroke="{MUTED}" stroke-width="1" stroke-dasharray="4,3"/>',
        f'<text x="{x + 16}" y="{y + 20}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">NOTE</text>',
        f'<text x="{x + 16}" y="{y + 36}" fill="{INK}" font-size="12" font-weight="600" font-family="{SANS}">DB が守る決まり（線と列で表せないもの）</text>',
    ]
    for i, t in enumerate(lines):
        out.append(f'<text x="{x + 16}" y="{y + 58 + i * 18}" fill="{INK}" font-size="9" font-family="{SANS}">{t}</text>')
    return out


def legend():
    y = H - 56
    return [
        f'<line x1="40" y1="{y}" x2="{W - 40}" y2="{y}" stroke="rgba(45,49,66,0.10)" stroke-width="0.8"/>',
        f'<text x="40" y="{y + 16}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.18em">LEGEND</text>',
        f'<text x="40" y="{y + 38}" fill="{INK}" font-size="10" font-family="{MONO}" font-weight="600">#</text>',
        f'<text x="54" y="{y + 38}" fill="{MUTED}" font-size="9" font-family="{SANS}">主キー</text>',
        f'<text x="112" y="{y + 38}" fill="{INK}" font-size="10" font-family="{MONO}" font-weight="600">→</text>',
        f'<text x="128" y="{y + 38}" fill="{MUTED}" font-size="9" font-family="{SANS}">ほかの表を指す列</text>',
        f'<text x="240" y="{y + 38}" fill="{MUTED}" font-size="10" font-family="{MONO}" font-weight="600">0..1 / 0..N / 1..N</text>',
        f'<text x="356" y="{y + 38}" fill="{MUTED}" font-size="9" font-family="{SANS}">線の端の表が、相手 1 行に対して何行つくか</text>',
        f'<text x="600" y="{y + 38}" fill="{MUTED}" font-size="9" font-family="{SANS}">点線の枠: 表の役割のまとまり</text>',
        f'<text x="780" y="{y + 38}" fill="{MUTED}" font-size="9" font-family="{SANS}">問い N: #72 の報告にあるオーナーへの問い</text>',
    ]


TS = [("created_at", "text"), ("updated_at", "text")]
C = [("created_at", "text")]

organization = [("# id", "integer"), ("name", "text · unique"), ("name_masked", "text")] + TS
career = [
    ("# id", "integer"), ("→ organization_id", "integer"), ("role", "text"), ("started_on", "text（年月）"),
    ("ended_on", "text（年月）· 空可"), ("description", "text · 空可"), ("url", "text · 空可"),
    ("is_masked", "integer"),
] + TS
project = [
    ("# id", "integer"), ("→ organization_id", "integer"), ("kind", "text · CHECK"),
    ("slug", "text · unique"), ("title", "text"), ("title_masked", "text"), ("is_masked", "integer"),
    ("is_highlighted", "integer"), ("→ card_media_id", "integer · 空可"), ("started_on", "text（年月）"),
    ("ended_on", "text（年月）· 空可"), ("description", "text · 空可"), ("url", "text · 空可"),
] + TS
education = [
    ("# id", "integer"), ("school", "text"), ("department", "text · 空可"),
    ("started_on", "text（年月）"), ("ended_on", "text（年月）· 空可"), ("remarks", "text · 空可"),
] + TS
skill = [("# id", "integer"), ("name", "text · unique · NOCASE"), ("years_override", "integer · 空可")] + TS
project_skill = [("# → project_id", "integer"), ("# → skill_id", "integer")]
activity = [
    ("# id", "integer"), ("→ source", "text"),
    ("external_id", "text · 空可"), ("url", "text · 空可"), ("title", "text · 空可"),
    ("description", "text · 空可"), ("image_url", "text · 空可"), ("published_at", "text · 空可"),
    ("sort_at", "生成列（VIRTUAL）· NOT NULL"),
    ("happened_on", "text（年月日）· 空可（life event）"), ("→ card_media_id", "integer · 空可（life event）"),
] + TS
fetch = [("# → source", "text"), ("fetched_at", "text"), ("is_ok", "integer"), ("reason", "text · 空可"), ("last_succeeded_at", "text · 空可")]
note = [
    ("# id", "integer"), ("slug", "text · unique"), ("status", "text · CHECK"),
    ("→ published_revision_id", "integer · 空可"), ("published_at", "text · 空可"),
    ("deleted_at", "text · 空可"), ("card_image", "text · CHECK"), ("→ card_media_id", "integer · 空可"),
] + TS
revision = [("# id", "integer"), ("→ note_id", "integer"), ("title", "text"), ("description", "text · 空可"), ("body", "text")] + C
media = [("# id", "integer"), ("→ note_id", "integer · 空可"), ("→ project_id", "integer · 空可"), ("→ career_id", "integer · 空可"), ("→ activity_id", "integer · 空可"), ("storage_key", "text · unique")] + C
synd = [("# id", "integer"), ("→ note_id", "integer"), ("url", "text · unique")] + C
link_preview = [("# id", "integer"), ("url", "text · unique"), ("title", "text · 空可"), ("image_url", "text · 空可"), ("fetched_at", "text")]
resume = [
    ("# id", "integer"), ("slug", "text · unique"), ("title", "text"), ("audience", "text · CHECK · 変更不可"), ("status", "text · CHECK"),
    ("limited_token_hash", "text · unique · 空可"), ("limited_expires_at", "text · 空可"),
] + TS
YM = [("started_on", "text（年月）"), ("ended_on", "text（年月）· 空可")]
resume_career = [("# id", "integer"), ("→ resume_id", "integer"), ("→ career_id", "integer · 空可"), ("organization_name", "text"), ("role", "text")] + YM + [("description", "text · 空可"), ("url", "text · 空可")]
resume_project = [("# id", "integer"), ("→ resume_id", "integer"), ("→ project_id", "integer · 空可"), ("organization_name", "text"), ("kind", "text · CHECK"), ("title", "text")] + YM + [("description", "text · 空可"), ("url", "text · 空可")]
resume_education = [("# id", "integer"), ("→ resume_id", "integer"), ("→ education_id", "integer · 空可"), ("school", "text"), ("department", "text · 空可")] + YM + [("remarks", "text · 空可")]

el = []
el += zone(20, 20, 535, 1010, "職務経歴書")
el += zone(560, 20, 540, 1088, "経歴（職歴・実績・学歴・スキル）")
el += zone(1120, 20, 600, 584, "activity")
el += zone(1120, 608, 600, 684, "note（転載先・URL カード・画像）")

# 職務経歴書
el += path("M 300,110 H 335")
el += path("M 300,280 H 318 V 380 H 335")
el += path("M 40,200 H 28 V 838 H 335")
el += path("M 440,606 V 640")
el += path("M 150,316 V 400")
el += label(306, 92, "1") + label(320, 114, "0..N")
el += label(306, 262, "1") + label(320, 384, "0..N")
el += label(34, 182, "1") + label(318, 820, "0..N")
el += label(454, 610, "1") + label(458, 626, "0..N")
el += label(164, 322, "1") + label(170, 384, "0..N")
# 職務経歴書 → 経歴
el += path("M 545,110 H 580")
el += path("M 545,400 H 562 V 460 H 580")
el += path("M 545,900 H 580")
el += label(559, 114, "0..N") + label(572, 92, "1")
el += label(559, 404, "0..N") + label(570, 442, "1")
el += label(559, 904, "0..N") + label(572, 882, "1")
# 経歴の中
el += path("M 820,110 H 880")
el += label(832, 92, "0..N") + label(868, 92, "1")
el += path("M 760,416 V 376 H 850 V 200 H 880")
el += label(776, 398, "0..N") + label(868, 182, "1")
el += path("M 820,720 H 880")
el += label(832, 702, "1") + label(860, 702, "0..N")
el += path("M 980,700 V 656")
el += label(994, 662, "1") + label(1002, 686, "0..N")
# timeline の中
el += path("M 1460,300 H 1500")
el += label(1472, 282, "0..N") + label(1492, 318, "1")
# timeline → note
el += path("M 1600,236 V 260")
el += label(1618, 250, "0..1") + label(1588, 250, "1")
# note の中
el += path("M 1420,716 H 1480")
el += label(1432, 698, "1") + label(1460, 698, "1..N")
el += rel_label(1450, 724, "NOTE_ID")
el += path("M 1420,796 H 1480")
el += label(1436, 778, "0..1") + label(1466, 778, "0..1")
el += rel_label(1450, 804, "PUBLISHED")
el += path("M 1420,904 H 1480")
el += label(1432, 886, "1") + label(1460, 886, "0..N")
el += path("M 1250,932 V 1012")
el += path("M 1330,932 V 1012")
el += label(1264, 938, "1") + label(1272, 994, "0..N")
el += rel_label(1215, 966, "NOTE_ID")
el += label(1352, 938, "0..1") + label(1352, 994, "0..1")
el += rel_label(1356, 966, "CARD")

el += entity(40, 60, 260, "resume", "職務経歴書の版。複数持つ", resume)
el += entity(335, 60, 210, "resume_career", "職務経歴書に写した職歴", resume_career)
el += entity(335, 330, 210, "resume_project", "職務経歴書に写した実績", resume_project)
el += entity(335, 780, 210, "resume_education", "職務経歴書に写した学歴", resume_education)
el += entity(880, 60, 200, "organization", "組織。会社・団体・自営業（個人）", organization)
el += entity(580, 60, 240, "career", "職歴。組織にオーナーが所属した履歴", career)
el += entity(580, 416, 240, "project", "実績。kind: application・talk・event・other", project)
el += entity(580, 832, 240, "education", "学歴", education)
el += entity(880, 480, 200, "skill", "スキル。経験年数は実績から計算", skill)
el += entity(880, 700, 200, "project_skill", "実績で使ったスキル", project_skill)
el += entity(1160, 60, 300, "activity", "1 件の activity（外部・life event）", activity)
el += entity(1500, 60, 200, "fetch_result", "外部の source ごとの最新の取得の成否", fetch)
el += entity(1500, 260, 200, "activity_source", "activity の出どころ。kind を 1 つ持つ", [("# source", "text"), ("kind", "text · CHECK")])
el += entity(1500, 404, 200, "activity_feed", "一覧。4 つの表を UNION ALL でつなぐ", [("activity", "外部・life event"), ("note", "公開中だけ"), ("project", "is_masked なら秘匿化"), ("career", "is_masked なら秘匿化"), ("career の日付", "started_on"), ("並び", "(日付, 種類, id)")], kind="VIEW")
el += entity(1160, 656, 260, "note", "synsk.me で書く記事の本体", note)
el += entity(1480, 656, 220, "note_revision", "note の版。保存と公開のたびに 1 行", revision)
el += entity(1160, 1012, 260, "media", "画像。持ち主の列は 1 つだけ入る。実体は R2", media)
el += entity(1480, 880, 220, "syndication", "note を転載した先の URL（POSSE）", synd)
el += entity(1480, 1056, 220, "link_preview", "URL カードの情報。本文の URL で引く", link_preview)
el += kinds_note(40, 1060)
el += rules_note(400, 1120)
el += entity(335, 640, 210, "resume_project_skill", "写した実績で使ったスキル", [("# → resume_project_id", "integer"), ("# skill_name", "text")])
el += entity(40, 400, 260, "resume_skill_override", "写した経験年数の上書き（上書きしたものだけ）", [("# → resume_id", "integer"), ("# skill_name", "text"), ("years_override", "integer")])
el += legend()
body = "\n      ".join(el)
svg = (
    f'<div class="scroll"><svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="er-title er-desc">\n'
    f'      <title id="er-title">synsk.me の DB 設計案</title>\n'
    f'      <desc id="er-desc">職務経歴書・経歴・activity・note の 4 つの役割にまとめた 20 の表と 1 つのビュー、表どうしのつながり。</desc>\n'
    f'      <rect width="100%" height="100%" fill="{PAPER}"/>\n'
    f'      {body}\n'
    f'    </svg></div>'
)

html = f'''<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>synsk.me の DB 設計案</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: 'Geist', 'Hiragino Kaku Gothic ProN', sans-serif; background: {PAPER}; color: {INK}; padding: 3rem 1rem; }}
    .frame {{ max-width: 1780px; margin: 0 auto; }}
    .eyebrow {{ font-family: 'Geist Mono', monospace; font-size: 0.66rem; letter-spacing: 0.18em; text-transform: uppercase; color: {MUTED}; margin-bottom: 0.5rem; }}
    h1 {{ font-family: 'Instrument Serif', 'Hiragino Mincho ProN', serif; font-size: 2rem; font-weight: 400; margin-bottom: 0.5rem; }}
    p.note {{ font-size: 0.85rem; color: {MUTED}; margin-bottom: 0.75rem; }}
    .scroll {{ overflow-x: auto; }}
    svg {{ width: 100%; min-width: {W}px; display: block; }}
  </style>
</head>
<body>
  <div class="frame">
    <p class="eyebrow">ER · #72</p>
    <h1>synsk.me の DB 設計案（20 の表と 1 つのビュー）</h1>
    <p class="note">列の名前は仮。どの表にも割り当てていないデータ（プロフィール系・note の更新日など）は図にない。職歴のスキルは表に持たず、同じ組織で期間が重なる実績から求める。link_preview は版の外に持ち、外部キーでつながない（本文の URL で引く）。media は note・project・career・activity（life event）の画像を持ち、図では note との線だけを描く。activity の一覧は activity_feed のビューで読み、note・project・career は activity に行を持たない。外部キーの線は、物理削除のときの扱いをすべて NO ACTION とする。</p>
    {svg}
  </div>
</body>
</html>
'''

with open(sys.argv[1], "w", encoding="utf-8") as f:
    f.write(html)
