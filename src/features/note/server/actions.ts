'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { addNoteSyndication as addNoteSyndicationUseCase } from '@/features/note/application/add-note-syndication';
import { createNote as createNoteUseCase } from '@/features/note/application/create-note';
import { deleteNote as deleteNoteUseCase } from '@/features/note/application/delete-note';
import { publishNote as publishNoteUseCase } from '@/features/note/application/publish-note';
import { removeNoteSyndication as removeNoteSyndicationUseCase } from '@/features/note/application/remove-note-syndication';
import { restoreNote as restoreNoteUseCase } from '@/features/note/application/restore-note';
import { revertNote as revertNoteUseCase } from '@/features/note/application/revert-note';
import { saveNote as saveNoteUseCase } from '@/features/note/application/save-note';
import { unpublishNote as unpublishNoteUseCase } from '@/features/note/application/unpublish-note';
import {
  NOTE_FIELDS,
  NOTE_UID_FIELD,
  OPENED_REVISION_UID_FIELD,
  REVISION_UID_FIELD,
  SYNDICATION_URL_FIELD,
  type NoteFormResult,
  type RevertNoteResult,
  type SyndicationFormResult,
} from '@/features/note/domain/note';
import { createNoteDeps } from '@/features/note/server/queries';
import { findIdByUid, parseUid } from '@/shared/domain/uid';
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

/** 下書きに戻し、同じ画面へ移る（FR-014） */
export const unpublishNote = async (
  _state: NoteFormResult | null,
  formData: FormData,
): Promise<NoteFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, uid, id } = await resolveNote(formData);
  if (id === null) redirect(LIST);

  const outcome = await unpublishNoteUseCase(deps.notes, author, id);
  if (outcome.status === 'forbidden') return outcome;
  if (outcome.status === 'not-found') redirect(LIST);
  redirect(`${editPath(uid)}?unpublished=1`);
};

/** 削除済みの印を付け、一覧へ移る（FR-016）。確認の画面（`/dash/notes/{uid}/delete`）のフォームが呼ぶ */
export const deleteNote = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, id } = await resolveNote(formData);
  if (id === null) redirect(LIST);

  const outcome = await deleteNoteUseCase(deps.notes, author, id, new Date().toISOString());
  if (outcome.status === 'forbidden') return outcome;
  redirect(outcome.status === 'deleted' ? `${LIST}?deleted=1` : LIST);
};

/** 削除済みの印を外し、編集の画面へ移る（FR-016） */
export const restoreNote = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, uid, id } = await resolveNote(formData);
  if (id === null) redirect(LIST);

  const outcome = await restoreNoteUseCase(deps.notes, author, id);
  if (outcome.status === 'forbidden') return outcome;
  if (outcome.status === 'not-found') redirect(LIST);
  redirect(`${editPath(uid)}?restored=1`);
};

/**
 * 過去の版の中身を新しい版として足し、編集の画面へ移る（FR-009）。開いた後に別の画面で保存されて
 * いたら書かずに知らせる（FR-020）。戻す版がその note に無ければ一覧へ移す
 */
export const revertNote = async (
  _state: RevertNoteResult | null,
  formData: FormData,
): Promise<RevertNoteResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, uid, id } = await resolveNote(formData);
  const revisionUid = parseUid(readString(formData, REVISION_UID_FIELD));
  const openedRevisionUid = parseUid(readString(formData, OPENED_REVISION_UID_FIELD));
  if (id === null || revisionUid === null) redirect(LIST);
  if (openedRevisionUid === null) return { status: 'conflict' };

  const outcome = await revertNoteUseCase(deps.notes, author, id, revisionUid, openedRevisionUid);
  if (outcome.status === 'reverted') redirect(`${editPath(uid)}?reverted=1`);
  if (outcome.status === 'not-found') redirect(LIST);
  return outcome;
};

/** 転載先の URL を記録し、同じ画面へ移る（FR-031）。記録済みの URL は入力を残して知らせる */
export const addNoteSyndication = async (
  _state: SyndicationFormResult | null,
  formData: FormData,
): Promise<SyndicationFormResult> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, uid, id } = await resolveNote(formData);
  if (id === null) redirect(LIST);

  const url = readString(formData, SYNDICATION_URL_FIELD);
  const outcome = await addNoteSyndicationUseCase(deps.notes, author, id, url);
  if (outcome.status === 'added') redirect(`${editPath(uid)}?syndicated=1`);
  if (outcome.status === 'not-found') redirect(LIST);
  if (outcome.status === 'forbidden') return outcome;
  return {
    status: 'invalid',
    errors: { [SYNDICATION_URL_FIELD]: outcome.error },
    values: { [SYNDICATION_URL_FIELD]: url },
  };
};

/** 転載先の URL を外し、同じ画面へ移る（FR-031、research.md の R14）。フォームは URL を送る */
export const removeNoteSyndication = async (
  _state: { status: 'forbidden' } | null,
  formData: FormData,
): Promise<{ status: 'forbidden' }> => {
  const author = await getCurrentAuthor();
  if (!author) return { status: 'forbidden' };
  const { deps, uid, id } = await resolveNote(formData);
  if (id === null) redirect(LIST);

  const outcome = await removeNoteSyndicationUseCase(
    deps.notes,
    author,
    id,
    readString(formData, SYNDICATION_URL_FIELD),
  );
  if (outcome.status === 'forbidden') return outcome;
  if (outcome.status === 'not-found') redirect(LIST);
  redirect(`${editPath(uid)}?unsyndicated=1`);
};
