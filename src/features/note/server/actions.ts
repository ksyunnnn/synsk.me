'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { addNoteImage as addNoteImageUseCase } from '@/features/note/application/add-note-image';
import { addSyndication as addSyndicationUseCase } from '@/features/note/application/add-syndication';
import { chooseCardImage as chooseCardImageUseCase } from '@/features/note/application/choose-card-image';
import { createNote as createNoteUseCase } from '@/features/note/application/create-note';
import { deleteNote as deleteNoteUseCase } from '@/features/note/application/delete-note';
import type { NoteDeps } from '@/features/note/application/deps';
import { publishNote as publishNoteUseCase } from '@/features/note/application/publish-note';
import { refreshLinkPreviews as refreshLinkPreviewsUseCase } from '@/features/note/application/refresh-link-previews';
import { removeSyndication as removeSyndicationUseCase } from '@/features/note/application/remove-syndication';
import { restoreRevision as restoreRevisionUseCase } from '@/features/note/application/restore-revision';
import { saveNote as saveNoteUseCase } from '@/features/note/application/save-note';
import { undeleteNote as undeleteNoteUseCase } from '@/features/note/application/undelete-note';
import { unpublishNote as unpublishNoteUseCase } from '@/features/note/application/unpublish-note';
import {
  NOTE_FIELDS,
  NOTE_UID_FIELD,
  OPENED_REVISION_FIELD,
  RESTORE_REVISION_FIELD,
  parseRevisionNumber,
  type NoteDoneKind,
  type NoteFormResult,
  type NoteFormValues,
  type NoteId,
  type NoteOperationResult,
} from '@/features/note/domain/note';
import { createNoteDeps } from '@/features/note/server/queries';
import { findIdByUid } from '@/shared/domain/uid';
import type { Author } from '@/shared/domain/author';
import { getCurrentAuthor } from '@/shared/server/author';
import { readString, readValues } from '@/shared/server/form-data';

/**
 * note のフォームが呼ぶ Server Action（specs/003-note/contracts/dash.md）。`page.tsx` が読み込み、
 * フォームの部品に props で渡す（ADR-0026 の依存の向き 3）。
 *
 * どの操作も、何より先にオーナーであることを確かめる。Server Action は経路に縛られず、
 * `/dash` の外への POST からも呼べるため（ADR-0036）。オーナーでなければ、入力した値を返さない
 */

const editPath = (uid: string, done?: NoteDoneKind, extra = '') =>
  `/dash/notes/${uid}${done ? `?done=${done}${extra}` : ''}`;

/**
 * オーナーを確かめ、フォームの uid が指す note の id を引く。オーナーでなければ null。note が
 * 無ければ一覧へ移す
 */
const resolve = async (
  formData: FormData,
): Promise<{ author: Author; deps: NoteDeps; uid: string; id: NoteId } | null> => {
  const author = await getCurrentAuthor();
  if (!author) return null;
  const deps = await createNoteDeps();
  const uid = readString(formData, NOTE_UID_FIELD);
  const id = await findIdByUid(deps.notes, uid);
  if (id === null) redirect('/dash/notes');
  return { author, deps, uid, id };
};

const FORBIDDEN = { status: 'forbidden' } as const;

/** note を作り、編集の画面へ移る */
export const createNote = async (
  _state: NoteFormResult | null,
  formData: FormData,
): Promise<NoteFormResult> => {
  const outcome = await createNoteUseCase(
    await createNoteDeps(),
    await getCurrentAuthor(),
    readValues(formData, NOTE_FIELDS),
  );
  if (outcome.status === 'created') redirect(editPath(outcome.uid, 'created'));
  return outcome;
};

/** note を保存し、同じ画面へ移る。先に別の画面で保存されていたら、入力を残して知らせる（FR-020） */
export const saveNote = async (
  _state: NoteFormResult | null,
  formData: FormData,
): Promise<NoteFormResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const { author, deps, uid, id } = resolved;
  const values: NoteFormValues = readValues(formData, NOTE_FIELDS);
  const outcome = await saveNoteUseCase(
    deps,
    author,
    id,
    values,
    parseRevisionNumber(readString(formData, OPENED_REVISION_FIELD)),
  );
  if (outcome.status === 'saved') redirect(`/dash/notes/${uid}?saved=${outcome.revision}`);
  if (outcome.status === 'not-found') redirect('/dash/notes');
  return outcome;
};

/** 最新の版を公開する（FR-011） */
export const publishNote = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const { author, deps, uid, id } = resolved;
  const outcome = await publishNoteUseCase(
    deps,
    author,
    id,
    parseRevisionNumber(readString(formData, OPENED_REVISION_FIELD)),
  );
  if (outcome.status === 'done') redirect(editPath(uid, 'published'));
  return outcome;
};

/** 下書きに戻す（FR-014） */
export const unpublishNote = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const outcome = await unpublishNoteUseCase(resolved.deps, resolved.author, resolved.id);
  if (outcome.status === 'done') redirect(editPath(resolved.uid, 'unpublished'));
  return outcome;
};

/** 削除し、一覧の画面へ移る（FR-016）。確認の画面（`/dash/notes/{uid}/delete`）のフォームが呼ぶ */
export const deleteNote = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const outcome = await deleteNoteUseCase(resolved.deps, resolved.author, resolved.id);
  if (outcome.status === 'done') redirect('/dash/notes?done=deleted');
  return outcome;
};

/** 削除を戻す（FR-016） */
export const undeleteNote = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const outcome = await undeleteNoteUseCase(resolved.deps, resolved.author, resolved.id);
  if (outcome.status === 'done') redirect(editPath(resolved.uid, 'undeleted'));
  return outcome;
};

/** 過去の版に戻す（FR-009） */
export const restoreRevision = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const outcome = await restoreRevisionUseCase(
    resolved.deps,
    resolved.author,
    resolved.id,
    parseRevisionNumber(readString(formData, RESTORE_REVISION_FIELD)),
    parseRevisionNumber(readString(formData, OPENED_REVISION_FIELD)),
  );
  if (outcome.status === 'done') redirect(editPath(resolved.uid, 'restored'));
  return outcome;
};

/** 画像を足す（FR-023）。足した画像のファイル名を添えて同じ画面へ移り、本文に貼る書き方を示す */
export const addNoteImage = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const file = formData.get('image');
  const outcome = await addNoteImageUseCase(
    resolved.deps,
    resolved.author,
    resolved.id,
    file instanceof File && file.size > 0
      ? { size: file.size, read: () => file.arrayBuffer() }
      : null,
  );
  if (outcome.status === 'added') {
    redirect(editPath(resolved.uid, 'image-added', `&image=${encodeURIComponent(outcome.file)}`));
  }
  return outcome;
};

/** 代表画像を選ぶ（FR-024・FR-025） */
export const chooseCardImage = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const [source, file = ''] = readString(formData, 'cardImage').split(':');
  const outcome = await chooseCardImageUseCase(resolved.deps, resolved.author, resolved.id, {
    source,
    file,
  });
  if (outcome.status === 'done') redirect(editPath(resolved.uid, 'card-image'));
  return outcome;
};

/** 転載先を記録する（FR-031） */
export const addSyndication = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const outcome = await addSyndicationUseCase(
    resolved.deps,
    resolved.author,
    resolved.id,
    readString(formData, 'syndicationUrl'),
  );
  if (outcome.status === 'done') redirect(editPath(resolved.uid, 'syndication-added'));
  return outcome;
};

/** 記録した転載先を消す */
export const removeSyndication = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const outcome = await removeSyndicationUseCase(
    resolved.deps,
    resolved.author,
    resolved.id,
    readString(formData, 'syndicationUrl'),
  );
  if (outcome.status === 'done') redirect(editPath(resolved.uid, 'syndication-removed'));
  return outcome;
};

/** 参照先の情報を取り直す（FR-029） */
export const refreshLinkPreviews = async (
  _state: NoteOperationResult | null,
  formData: FormData,
): Promise<NoteOperationResult> => {
  const resolved = await resolve(formData);
  if (!resolved) return FORBIDDEN;
  const outcome = await refreshLinkPreviewsUseCase(resolved.deps, resolved.author, resolved.id);
  if (outcome.status === 'done') {
    redirect(editPath(resolved.uid, 'refreshed', `&count=${outcome.count}`));
  }
  return outcome;
};
