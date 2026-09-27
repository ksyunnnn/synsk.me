'use server';

import 'server-only';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { createNote } from '@/features/note/application/create-note';
import { deleteNote } from '@/features/note/application/delete-note';
import { publishNote } from '@/features/note/application/publish-note';
import { saveNote } from '@/features/note/application/save-note';
import {
  NOTE_ID_FIELD,
  parseNoteId,
  type DeleteNoteFormState,
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

const withResult = (values: NoteContent, result: NoteFormResult | null): NoteFormState => ({
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

/** 編集のフォームで押したボタン。`intent` の name で送られる */
type EditIntent = 'save' | 'publish';

const readIntent = (formData: FormData): EditIntent | null => {
  const intent = readString(formData, 'intent');
  return intent === 'save' || intent === 'publish' ? intent : null;
};

/**
 * 編集のフォームの操作。押したボタン（`intent`）で、保存するか、保存して公開するかを
 * 分ける。移動せず、同じ画面に結果を返す。
 *
 * 保存と公開を別の Server Action にしない。1つのフォームに `useActionState` の
 * 操作を2つ置くと、JavaScript なしの送信で、どちらの状態へ結果を返すかを取り違える。
 * React は結果を返す先を、フォームの中の最初の `$ACTION_KEY` の hidden の入力で
 * 決め、押したボタンのものを選ばない（`react-server-dom-webpack` の `decodeFormState`）
 */
export const editNoteAction = async (
  _state: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> => {
  if (!(await getCurrentAuthor())) return FORBIDDEN_STATE;

  const values = readContent(formData);
  const intent = readIntent(formData);
  // どちらのボタンで送られたか分からなければ、書き込まない
  if (intent === null) return withResult(values, null);
  const id = parseNoteId(readString(formData, NOTE_ID_FIELD));
  if (id === null) return withResult(values, 'not-found');

  const notes = await createNoteRepository();
  const outcome =
    intent === 'save'
      ? await saveNote(notes, id, values)
      : await publishNote(notes, id, values, new Date().toISOString());
  if (outcome.ok) {
    // 画面の状態（下書きか公開か）と、slug を変えられるかを、JavaScript ありの
    // 送信でも描画し直す。JavaScript なしの送信は、ページ全体を描画し直す
    refresh();
    return withResult(values, intent === 'save' ? 'saved' : 'published');
  }
  switch (outcome.reason) {
    case 'invalid':
      return { values, errors: outcome.errors, result: null };
    case 'failed':
      return withResult(values, intent === 'save' ? 'save-failed' : 'publish-failed');
    default:
      return withResult(values, outcome.reason);
  }
};

/**
 * note を削除し、一覧の画面へ移る。確認の画面（`/dash/notes/{id}/delete`）のフォームが呼ぶ。
 * note が存在しなければ、書き込まずに一覧の画面へ移る。削除に失敗すれば、確認の画面に
 * 失敗を返す
 */
export const deleteNoteAction = async (
  _state: DeleteNoteFormState,
  formData: FormData,
): Promise<DeleteNoteFormState> => {
  if (!(await getCurrentAuthor())) return { result: 'forbidden' };

  const id = parseNoteId(readString(formData, NOTE_ID_FIELD));
  if (id === null) redirect('/dash');

  const outcome = await deleteNote(await createNoteRepository(), id);
  if (outcome.ok) redirect('/dash?deleted=1');
  if (outcome.reason === 'not-found') redirect('/dash');
  return { result: 'delete-failed' };
};
