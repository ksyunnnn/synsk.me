import type { NoteFormValues, RevisionNumber } from '@/features/note/domain/note';

/**
 * 書きかけの内容を、書いている端末の `localStorage` に持つ（specs/003-note/research.md の R11、
 * REQUIREMENTS.md の FR-14）。D1 には書かない（FR-018）。書き始めたときの版の番号を添え、
 * 戻したときに保存の衝突を確かめられるようにする。
 *
 * `localStorage` は、非公開のウィンドウやサイトのデータを消した状態で使えないことがある。
 * 読み書きに失敗しても入力は止めない
 */

export type NoteDraft = {
  values: NoteFormValues;
  /** 書き始めたときの最新の版の番号。作る画面では 0 */
  baseRevision: RevisionNumber;
};

const PREFIX = 'synsk-note-draft:';

/** note の uid ごとのキー。作る画面は `new` */
export const draftKey = (uid: string | null) => `${PREFIX}${uid ?? 'new'}`;

export const readDraft = (key: string): NoteDraft | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NoteDraft>;
    const values = parsed.values;
    if (
      !values ||
      typeof parsed.baseRevision !== 'number' ||
      !['slug', 'title', 'description', 'body'].every(
        (field) => typeof values[field as keyof NoteFormValues] === 'string',
      )
    ) {
      return null;
    }
    return { values, baseRevision: parsed.baseRevision };
  } catch {
    return null;
  }
};

export const writeDraft = (key: string, draft: NoteDraft) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // 持てなくても入力は続けられる
  }
};

export const clearDraft = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 消せなくても次に開いたときに内容が同じなら戻さない
  }
};

export const sameValues = (a: NoteFormValues, b: NoteFormValues) =>
  a.slug === b.slug && a.title === b.title && a.description === b.description && a.body === b.body;
