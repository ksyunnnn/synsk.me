import 'server-only';

import { forbidden } from 'next/navigation';
import { getNoteForEdit as getNoteForEditUseCase } from '@/features/note/application/get-note-for-edit';
import { getPublishedNote as getPublishedNoteUseCase } from '@/features/note/application/get-published-note';
import { listNotes } from '@/features/note/application/list-notes';
import {
  parseNoteId,
  type EditableNoteDto,
  type NoteSummaryDto,
  type PublishedNoteDto,
} from '@/features/note/domain/note';
import type { Author } from '@/features/note/server/author';
import { createNoteRepository, getCurrentAuthor } from '@/features/note/server/context';

/**
 * note の画面が呼ぶ組み立て用の関数（ADR-0030）。
 *
 * D1 から読み出せなければ投げる。画面は投げられた例外で 500 を返す
 * （`src/app/global-error.tsx`）。
 */

/**
 * 作り手であることを確かめる。確かめられなければ `forbidden()` で、画面の中身を
 * 返さずに 403 にする。`/dash` 配下の画面は、何かを読む前にこれを通す
 * （docs/decisions/0036-verify-access-jwt-in-app.md）
 */
export const requireAuthor = async (): Promise<Author> => {
  const author = await getCurrentAuthor();
  if (!author) forbidden();
  return author;
};

/** 訪問者に見せる note。下書きと存在しない slug は null */
export const getPublishedNote = async (slug: string): Promise<PublishedNoteDto | null> =>
  getPublishedNoteUseCase(await createNoteRepository(), slug);

/** 作り手向けの一覧。作り手でなければ 403 */
export const listNotesForAuthor = async (): Promise<NoteSummaryDto[]> => {
  await requireAuthor();
  return listNotes(await createNoteRepository());
};

/** 作り手が編集する note。作り手でなければ 403。`id` の note がなければ null */
export const getNoteForEdit = async (id: string): Promise<EditableNoteDto | null> => {
  await requireAuthor();
  const noteId = parseNoteId(id);
  return noteId === null ? null : getNoteForEditUseCase(await createNoteRepository(), noteId);
};
