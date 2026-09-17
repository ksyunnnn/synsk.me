'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { createNote } from '@/features/note/application/create-note';
import { publishNote } from '@/features/note/application/publish-note';
import {
  parseNoteId,
  toNoteFormState,
  type NoteContent,
  type NoteFormResult,
  type NoteFormState,
} from '@/features/note/domain/note';
import { createNoteRepository, getCurrentAuthor } from '@/features/note/server/context';

/**
 * note のフォームが呼ぶ Server Action。`page.tsx` が読み込み、フォームの部品に
 * props で渡す（ADR-0026 の依存の向き 3）。
 *
 * どの操作も、何より先に作り手であることを確かめる。vinext の Server Action は
 * 経路に縛られず、`/dash` の外への POST からも呼べるため
 * （docs/decisions/0036-verify-access-jwt-in-app.md）。
 * 別のサイトから送られた操作は、vinext が Origin を確かめて、呼ぶ前に拒む。
 */

/** 作り手であることを確かめられないときの状態。入力した値を残さない（spec の Edge Cases） */
const FORBIDDEN_STATE: NoteFormState = { ...toNoteFormState(), result: 'forbidden' };

const readString = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

const readContent = (formData: FormData): NoteContent => ({
  slug: readString(formData, 'slug'),
  title: readString(formData, 'title'),
  // JavaScript なしで送られたフォームは、本文の改行を CRLF にする。JavaScript ありの
  // 送信と同じ LF に揃え、文字数の数え方を送り方で変えない
  body: readString(formData, 'body').replace(/\r\n?/g, '\n'),
});

const withResult = (values: NoteContent, result: NoteFormResult): NoteFormState => ({
  values,
  errors: {},
  result,
});

/** 下書きの note を作り、編集の画面へ移る */
export const createNoteAction = async (
  _state: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> => {
  if (!(await getCurrentAuthor())) return FORBIDDEN_STATE;

  const values = readContent(formData);
  const outcome = await createNote(await createNoteRepository(), values);
  if (!outcome.ok) {
    switch (outcome.reason) {
      case 'invalid':
        return { values, errors: outcome.errors, result: null };
      case 'slug-taken':
        return withResult(values, 'slug-taken');
      case 'failed':
        return withResult(values, 'save-failed');
    }
  }
  redirect(`/dash/notes/${outcome.id}`);
};

/** 入力した内容を保存して公開する。移動せず、同じ画面に結果を返す */
export const publishNoteAction = async (
  _state: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> => {
  if (!(await getCurrentAuthor())) return FORBIDDEN_STATE;

  const values = readContent(formData);
  const id = parseNoteId(readString(formData, 'id'));
  if (id === null) return withResult(values, 'not-found');

  const outcome = await publishNote(
    await createNoteRepository(),
    id,
    values,
    new Date().toISOString(),
  );
  if (outcome.ok) return withResult(values, 'published');
  switch (outcome.reason) {
    case 'invalid':
      return { values, errors: outcome.errors, result: null };
    case 'failed':
      return withResult(values, 'publish-failed');
    default:
      return withResult(values, outcome.reason);
  }
};
