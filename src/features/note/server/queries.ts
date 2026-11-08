import 'server-only';

import { cache } from 'react';
import type { NoteDeps } from '@/features/note/application/deps';
import { getVisitorNote as getVisitorNoteUseCase } from '@/features/note/application/get-visitor-note';
import type {
  NoteForEdit,
  NoteRevision,
  NoteSummary,
  RevisionNumber,
  VisitorNote,
  LinkPreview,
} from '@/features/note/domain/note';
import { isNoteImageFile, toStorageKey } from '@/features/note/domain/note-image';
import { extractCardUrls } from '@/features/note/domain/link-card';
import { createD1NoteRepository } from '@/features/note/server/d1-note-repository';
import { fetchLinkPreviews } from '@/features/note/server/link-preview-fetcher';
import { parseRevisionNumber } from '@/features/note/domain/note';
import { findIdByUid } from '@/shared/domain/uid';
import { getCurrentAuthor, requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';
import {
  createR2MediaStorage,
  getMediaStorage,
  type StoredMedia,
} from '@/shared/server/media-storage';

/**
 * note の画面・route handler・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030）。
 * D1 から読み出せなければ投げる。画面は投げられた例外で 500 を返す
 */

export const createNoteDeps = async (): Promise<NoteDeps> => {
  const env = await readEnv();
  return {
    notes: createD1NoteRepository(env.DB),
    images: createR2MediaStorage(env.NOTE_IMAGES),
    fetchLinkPreviews: (urls) => fetchLinkPreviews(urls),
    now: () => new Date().toISOString(),
  };
};

/**
 * 訪問者に見せる note。無い識別子・下書き・削除した note なら null。ページの本体とメタデータの
 * 両方が呼ぶため、1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const getVisitorNote = cache(async (slug: string): Promise<VisitorNote | null> =>
  getVisitorNoteUseCase((await createNoteDeps()).notes, slug),
);

/** 訪問者に返す画像（FR-026）。返せなければ null */
export const getVisitorNoteImage = async (
  slug: string,
  file: string,
): Promise<StoredMedia | null> => {
  if (!isNoteImageFile(file)) return null;
  const { notes } = await createNoteDeps();
  const key = await notes.findVisitorImage(slug, toStorageKey(file));
  return key === null ? null : (await getMediaStorage()).get(key);
};

/** オーナーの一覧。オーナーでなければ 403 */
export const listNotes = async (): Promise<NoteSummary[]> => {
  await requireAuthor();
  return (await createNoteDeps()).notes.list();
};

/** オーナーが編集する note。オーナーでなければ 403。無い uid なら null */
export const getNoteForEdit = async (uid: string): Promise<NoteForEdit | null> => {
  await requireAuthor();
  const { notes } = await createNoteDeps();
  const id = await findIdByUid(notes, uid);
  return id === null ? null : notes.findForEdit(id);
};

/**
 * プレビュー（REQUIREMENTS.md の FR-13）に出す参照先の情報。最新の版の本文のカードにする
 * URL のうち、保存してあるもの。オーナーでなければ 403
 */
export const getLinkPreviewsForPreview = async (
  body: string,
): Promise<Record<string, LinkPreview>> => {
  await requireAuthor();
  const previews = await (await createNoteDeps()).notes.findLinkPreviews(extractCardUrls(body));
  return Object.fromEntries(previews.map((preview) => [preview.url, preview]));
};

/** 版の一覧。オーナーでなければ 403。無い uid なら null */
export const listNoteRevisions = async (
  uid: string,
): Promise<{ note: NoteForEdit; revisions: NoteRevision[] } | null> => {
  const note = await getNoteForEdit(uid);
  if (!note) return null;
  return { note, revisions: await (await createNoteDeps()).notes.listRevisions(note.id) };
};

/** 1 つの版。オーナーでなければ 403。無い uid・番号なら null */
export const getNoteRevision = async (
  uid: string,
  numberText: string,
): Promise<{ note: NoteForEdit; revision: NoteRevision } | null> => {
  const note = await getNoteForEdit(uid);
  const number = parseRevisionNumber(numberText);
  if (!note || number === null) return null;
  const revision = await (await createNoteDeps()).notes.findRevision(note.id, number);
  return revision ? { note, revision } : null;
};

/**
 * オーナーが見る画像。オーナーでなければ `forbidden`。その note の画像でなければ null。
 * route handler が呼ぶため、`forbidden()` で投げずに値で返す
 */
export const getOwnerNoteImage = async (
  uid: string,
  file: string,
): Promise<StoredMedia | null | 'forbidden'> => {
  if (!(await getCurrentAuthor())) return 'forbidden';
  if (!isNoteImageFile(file)) return null;
  const { notes } = await createNoteDeps();
  const id = await findIdByUid(notes, uid);
  if (id === null) return null;
  const key = await notes.findOwnerImage(id, toStorageKey(file));
  return key === null ? null : (await getMediaStorage()).get(key);
};

/*
 * 以下は `src/proxy.ts` が描画の前に呼ぶ。題や本文を読まず、有無だけを返す
 */

/** 訪問者に見せる note がある識別子か。`getVisitorNote` が null を返さない識別子と一致する */
export const hasNoteSlug = async (slug: string): Promise<boolean> =>
  (await createNoteDeps()).notes.hasVisitorSlug(slug);

/** オーナーが開ける note がある uid か */
export const hasNoteUid = async (uid: string): Promise<boolean> =>
  (await findIdByUid((await createNoteDeps()).notes, uid)) !== null;

/** uid の note が、その番号の版を持つか */
export const hasNoteRevision = async (uid: string, numberText: string): Promise<boolean> => {
  const number: RevisionNumber | null = parseRevisionNumber(numberText);
  if (number === null) return false;
  const { notes } = await createNoteDeps();
  const id = await findIdByUid(notes, uid);
  return id !== null && (await notes.hasRevision(id, number));
};
