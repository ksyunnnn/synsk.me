import { ImageResponse } from 'next/og';
import { getVisitorNote } from '@/features/note/server/queries';

/**
 * 題を入れて自動で作る代表画像（specs/003-note/spec.md の FR-024、research.md の R8）。
 * 公開で削除していない note だけに作り、ほかは 404。1200×630（docs/CRAWLING.md）。
 *
 * 題の文字は、Noto Sans JP を Google Fonts から題の文字だけの部分集合で取る。取れなければ、
 * 題を入れずにサイト名だけを描く（文字化けした題を出さない）
 */

const SIZE = { width: 1200, height: 630 };
const FONT_TIMEOUT_MS = 3_000;

/** 題の文字だけを持つ書体のデータ。取れなければ null */
const loadFont = async (text: string): Promise<ArrayBuffer | null> => {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@600&text=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(FONT_TIMEOUT_MS) },
    );
    if (!css.ok) return null;
    const url = (await css.text()).match(
      /src: url\((https:\/\/[^)]+)\) format\('(?:truetype|opentype)'\)/,
    )?.[1];
    if (!url) return null;
    const font = await fetch(url, { signal: AbortSignal.timeout(FONT_TIMEOUT_MS) });
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    return null;
  }
};

export const GET = async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const note = await getVisitorNote((await params).slug);
  if (!note) return new Response('Not Found', { status: 404 });

  const siteName = 'synsk.me';
  const font = await loadFont(`${note.title}${siteName}`);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: 'white',
        color: '#2C2F32',
        fontFamily: font ? 'Noto Sans JP' : undefined,
      }}
    >
      <div style={{ display: 'flex', fontSize: 64, lineHeight: 1.3 }}>{font ? note.title : ''}</div>
      <div style={{ display: 'flex', fontSize: 32 }}>{siteName}</div>
    </div>,
    {
      ...SIZE,
      fonts: font ? [{ name: 'Noto Sans JP', data: font, weight: 600, style: 'normal' }] : [],
      headers: { 'Cache-Control': 'no-store, must-revalidate' },
    },
  );
};
