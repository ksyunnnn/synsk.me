/**
 * 本文のどの URL をカードにするか（specs/003-note/research.md の R9）。URL 1 つだけの段落
 * （行に URL だけを書き、前後を空行で区切る）をカードにする。文の中のリンクはカードにしない
 */

/** 1 回の保存・取り直しで、参照先へ取りに行く URL の数の上限（constitution II） */
export const LINK_PREVIEW_MAX_FETCHES = 10;

/** 段落 1 つの文字列が、カードにする URL か。`<URL>` の形も受け付ける。そうでなければ null */
export const toCardUrl = (paragraph: string): string | null => {
  const text = paragraph.trim().replace(/^<(.*)>$/, '$1');
  if (!/^https?:\/\/\S+$/.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? text : null;
  } catch {
    return null;
  }
};

/**
 * 本文のカードにする URL を、出てくる順に重ねずに返す。コードの塊（``` か ~~~ で囲んだ行）の
 * 中は見ない
 */
export const extractCardUrls = (body: string): string[] => {
  const urls: string[] = [];
  let paragraph: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    if (paragraph.length === 1) {
      const url = toCardUrl(paragraph[0]);
      if (url && !urls.includes(url)) urls.push(url);
    }
    paragraph = [];
  };

  for (const line of body.split(/\r\n?|\n/)) {
    const fenceMark = line.trimStart().match(/^(```|~~~)/)?.[1];
    if (fence) {
      if (fenceMark === fence) fence = null;
      continue;
    }
    if (fenceMark) {
      flush();
      fence = fenceMark;
      continue;
    }
    if (line.trim() === '') flush();
    else paragraph.push(line);
  }
  flush();
  return urls;
};

/** 参照先の画像の URL として持つか。混在の内容を避けるため `https` だけ（research.md の R9） */
export const toPreviewImageUrl = (value: string | null, base: string): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};
