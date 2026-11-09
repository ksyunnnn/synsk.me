import 'server-only';

import { cache } from 'react';
import type { NoteDeps } from '@/features/note/application/deps';
import { getNoteForEdit as getNoteForEditUseCase } from '@/features/note/application/get-note-for-edit';
import { getVisitorNote as getVisitorNoteUseCase } from '@/features/note/application/get-visitor-note';
import { listNotes as listNotesUseCase } from '@/features/note/application/list-notes';
import type { Note, NoteSummary, VisitorNote } from '@/features/note/domain/note';
import { createD1NoteRepository } from '@/features/note/server/d1-note-repository';
import { findIdByUid } from '@/shared/domain/uid';
import { requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';

/**
 * note の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030）。
 * D1 から読み出せなければ投げる。画面は投げられた例外で 500 を返す
 */

export const createNoteDeps = async (): Promise<NoteDeps> => {
  const { DB } = await readEnv();
  return { notes: createD1NoteRepository(DB) };
};

/**
 * 訪問者に見せる note。公開で削除していない note の識別子でなければ null。ページの本体と
 * メタデータの両方が呼ぶため、1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const getVisitorNote = cache(async (slug: string): Promise<VisitorNote | null> =>
  getVisitorNoteUseCase((await createNoteDeps()).notes, slug),
);

/** オーナーの一覧。オーナーでなければ 403 */
export const listNotes = async (): Promise<NoteSummary[]> => {
  await requireAuthor();
  return listNotesUseCase((await createNoteDeps()).notes);
};

/** オーナーが編集する note。削除した note も返す。オーナーでなければ 403。無い uid なら null */
export const getNoteForEdit = async (uid: string): Promise<Note | null> => {
  await requireAuthor();
  const { notes } = await createNoteDeps();
  const id = await findIdByUid(notes, uid);
  return id === null ? null : getNoteForEditUseCase(notes, id);
};

/*
 * 以下は `src/proxy.ts` が描画の前に呼ぶ。題や本文を読まず、有無だけを返す
 */

/** 訪問者に見せる note がある識別子か。`getVisitorNote` が null を返さない識別子と一致する */
export const hasNoteSlug = async (slug: string): Promise<boolean> =>
  (await createNoteDeps()).notes.hasVisitorSlug(slug);

/**
 * オーナーが開ける note がある uid か。削除した note でも真を返す（削除した note の画面で
 * 「元に戻す」を置くため。contracts/dash.md の共通）。`getNoteForEdit` が null を返さない uid と一致する
 */
export const hasNoteUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid((await createNoteDeps()).notes, uid)) !== null;
