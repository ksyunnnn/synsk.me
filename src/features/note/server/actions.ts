'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { createNote as createNoteUseCase } from '@/features/note/application/create-note';
import { publishNote as publishNoteUseCase } from '@/features/note/application/publish-note';
import { saveNote as saveNoteUseCase } from '@/features/note/application/save-note';
import {
  NOTE_FIELDS,
  NOTE_UID_FIELD,
  OPENED_REVISION_UID_FIELD,
  type NoteFormResult,
} from '@/features/note/domain/note';
import { createNoteDeps } from '@/features/note/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readValues } from '@/shared/server/form-data';

/**
 * note のフォームが呼ぶ Server Action（specs/003-note/contracts/dash.md）。`page.tsx` が読み込み、
 * フォームの部品に props で渡す（ADR-0026 の依存の向き 3）。
 *
 * どの操作も、何より先にオーナーであることを確かめる。Server Action は経路に縛られず、`/dash` の
 * 外への POST からも呼べるため（ADR-0036）。オーナーでなければ、入力した値を返さない。
 * note は uid と開いた版の uid を隠しフィールドで送る。無い・削除した note は一覧へ移す
 */

const LIST = '/dash/notes';
const editPath = (uid: string) => `/dash/notes/${uid}`;

/** フォームの uid が指す note の id。無い uid なら null。オーナーの確認の後に呼ぶ */
const resolveNote = async (formData: FormData) => {
  const deps = await createNoteDeps();
  const uid = readString(formData, NOTE_UID_FIELD);
  const id = await findIdByUid(deps.notes, uid);
  return { deps, uid, id };
};

/** note を作り、編集の画面へ移る */
export const createNote = async (
  _state: NoteFormResult | null,
  formData: FormData,
): Promise<NoteFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const outcome = await createNoteUseCase(
    (await createNoteDeps()).notes,
    author,
    readValues(formData, NOTE_FIELDS),
  );
  if (outcome.status === 'created') redirect(`${editPath(outcome.uid)}?saved=1`);
  return outcome;
};

/** 版を 1 つ足し、同じ画面へ移る。先に保存されていたら、入力を残して知らせる（FR-020） */
export const saveNote = async (
  _state: NoteFormResult | null,
  formData: FormData,
): Promise<NoteFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, uid, id } = await resolveNote(formData);
  if (id === null) redirect(LIST);

  const outcome = await saveNoteUseCase(
    deps.notes,
    author,
    id,
    readValues(formData, NOTE_FIELDS),
    readString(formData, OPENED_REVISION_UID_FIELD),
  );
  if (outcome.status === 'saved') redirect(`${editPath(uid)}?saved=1`);
  if (outcome.status === 'not-found') redirect(LIST);
  return outcome;
};

/** その時点の最も新しい版を公開し、同じ画面へ移る（FR-011） */
export const publishNote = async (
  _state: NoteFormResult | null,
  formData: FormData,
): Promise<NoteFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, uid, id } = await resolveNote(formData);
  if (id === null) redirect(LIST);

  const outcome = await publishNoteUseCase(deps.notes, author, id, new Date().toISOString());
  if (outcome.status === 'published') redirect(`${editPath(uid)}?published=1`);
  if (outcome.status === 'not-found') redirect(LIST);
  return outcome;
};
