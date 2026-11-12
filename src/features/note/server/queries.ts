import 'server-only';

import { cache } from 'react';
import type { LinkPreviewSource, NoteDeps } from '@/features/note/application/deps';
import { getNoteForEdit as getNoteForEditUseCase } from '@/features/note/application/get-note-for-edit';
import { getNotePreview as getNotePreviewUseCase } from '@/features/note/application/get-note-preview';
import { getPreviewNoteMedia as getPreviewNoteMediaUseCase } from '@/features/note/application/get-preview-note-media';
import { getVisitorNote as getVisitorNoteUseCase } from '@/features/note/application/get-visitor-note';
import { getVisitorNoteMedia as getVisitorNoteMediaUseCase } from '@/features/note/application/get-visitor-note-media';
import {
  getNoteRevision as getNoteRevisionUseCase,
  listNoteRevisions as listNoteRevisionsUseCase,
} from '@/features/note/application/list-note-revisions';
import { listNotes as listNotesUseCase } from '@/features/note/application/list-notes';
import type {
  Note,
  NotePreview,
  NoteRevision,
  NoteRevisionSummary,
  NoteSummary,
  VisitorNote,
} from '@/features/note/domain/note';
import { createD1NoteRepository } from '@/features/note/server/d1-note-repository';
import { parseMediaStorageKey } from '@/shared/domain/media';
import { findIdByUid, parseUid } from '@/shared/domain/uid';
import { getCurrentAuthor, requireAuthor } from '@/shared/server/author';
import { readEnv } from '@/shared/server/env';
import {
  fetchLinkPreview,
  fetchLinkPreviews as fetchLinkPreviewResults,
} from '@/features/note/server/link-preview-fetch';
import { createMediaStorage, respondWithMedia, withNoindex } from '@/shared/server/media-storage';

/**
 * note の画面・Server Action・`src/proxy.ts` が呼ぶ組み立て用の関数（ADR-0030）。
 * D1 から読み出せなければ投げる。画面は投げられた例外で 500 を返す
 */

/**
 * 参照先の題と画像の URL を取り、取れた URL だけを返す（research.md の R13）。取れなかった URL は
 * 書かないため、次に見た目の確認を開いたときに取り直す。上限は取得の部品の本番の値
 */
const fetchLinkPreviews: LinkPreviewSource = async (urls) =>
  (await fetchLinkPreviewResults(urls)).flatMap((result) =>
    result.status === 'fetched'
      ? [{ url: result.url, title: result.title, imageUrl: result.imageUrl }]
      : [],
  );

export const createNoteDeps = async (): Promise<NoteDeps> => {
  const { DB } = await readEnv();
  return {
    notes: createD1NoteRepository(DB),
    media: await createMediaStorage(),
    fetchLinkPreviews,
    fetchLinkPreview: (url) => fetchLinkPreview(url),
  };
};

/**
 * 見た目の確認の画面の画像（docs/REQUIREMENTS.md の FR-13）。`/dash/notes/{uid}/preview/media/{key}`
 * の `route.ts` が呼ぶ。オーナーにだけ、確認している版の本文が指す画像と代表画像を返す。オーナーで
 * なければ D1 の note を読まずに 404 にする（`/dash` 配下は `src/proxy.ts` も 403 にする）
 */
export const respondWithPreviewNoteMedia = async (uid: string, key: string): Promise<Response> => {
  const deps = await createNoteDeps();
  const author = await getCurrentAuthor();
  // オーナーでないときと形の違うキーは、D1 を読まずに `respondWithMedia` が 404 にする。
  // `restricted` は ETag を付けず、どのキャッシュにも残さない（NFR-09）
  const id =
    author === null || parseMediaStorageKey(key) === null
      ? null
      : await findIdByUid(deps.notes, uid);
  const access =
    id === null ? 'hidden' : await getPreviewNoteMediaUseCase(deps.notes, author, id, key);
  return respondWithMedia(deps.media, key, access);
};

/**
 * note の画像を訪問者に見せてよいか（FR-026）。`/notes/{slug}/media/{key}` の `route.ts` が呼び、
 * 結果を共有担当の `respondWithMedia` に渡す（research.md の R9・R12）
 */
export const respondWithNoteMedia = async (
  slug: string,
  key: string,
  ifNoneMatch: string | null,
): Promise<Response> => {
  const { notes, media } = await createNoteDeps();
  // 形の違うキーは、D1 を読まずに `respondWithMedia` が 404 にする
  const access =
    parseMediaStorageKey(key) === null
      ? 'hidden'
      : await getVisitorNoteMediaUseCase(notes, slug, key);
  return withNoindex(await respondWithMedia(media, key, access, ifNoneMatch));
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

/**
 * 見た目の確認で描く形（REQUIREMENTS.md の FR-13）。オーナーでなければ 403。無い uid なら null。
 * 参照先の情報を持たない URL は、描く前に取る（U9 の決定）
 */
export const getNotePreview = async (uid: string): Promise<NotePreview | null> => {
  await requireAuthor();
  const deps = await createNoteDeps();
  const id = await findIdByUid(deps.notes, uid);
  return id === null ? null : getNotePreviewUseCase(deps, id, new Date().toISOString());
};

/**
 * オーナーが見る note と版の一覧（FR-008）。オーナーでなければ 403。無い uid なら null
 */
export const listNoteRevisions = async (
  uid: string,
): Promise<{ note: Note; revisions: NoteRevisionSummary[] } | null> => {
  await requireAuthor();
  const { notes } = await createNoteDeps();
  const id = await findIdByUid(notes, uid);
  if (id === null) return null;
  const [note, revisions] = await Promise.all([
    getNoteForEditUseCase(notes, id),
    listNoteRevisionsUseCase(notes, id),
  ]);
  return note ? { note, revisions } : null;
};

/**
 * オーナーが見る note と、その note の 1 つの版（FR-008）。オーナーでなければ 403。note が無いか、
 * 版がその note に無ければ null
 */
export const getNoteRevision = async (
  uid: string,
  revisionUid: string,
): Promise<{ note: Note; revision: NoteRevision } | null> => {
  await requireAuthor();
  const { notes } = await createNoteDeps();
  const id = await findIdByUid(notes, uid);
  const parsedRevisionUid = parseUid(revisionUid);
  if (id === null || parsedRevisionUid === null) return null;
  const [note, revision] = await Promise.all([
    getNoteForEditUseCase(notes, id),
    getNoteRevisionUseCase(notes, id, parsedRevisionUid),
  ]);
  return note && revision ? { note, revision } : null;
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

/**
 * 過去の版の画面（`/dash/notes/{uid}/revisions/{revisionUid}`）の有無。note が無ければ `note`、
 * 版がその note に無ければ `revision`。`getNoteRevision` が null を返さない組と一致する
 */
export const findMissingNoteRevision = async (
  uid: string,
  revisionUid: string,
): Promise<'note' | 'revision' | null> => {
  const noteUid = parseUid(uid);
  if (noteUid === null) return 'note';
  const { notes } = await createNoteDeps();
  const parsedRevisionUid = parseUid(revisionUid);
  if (parsedRevisionUid === null)
    return (await notes.findIdByUid(noteUid)) === null ? 'note' : 'revision';
  return notes.findMissingRevision(noteUid, parsedRevisionUid);
};
