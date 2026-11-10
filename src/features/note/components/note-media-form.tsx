'use client';

import { useActionState } from 'react';
import {
  MEDIA_FILE_FIELD,
  NOTE_UID_FIELD,
  mediaMarkOf,
  type MediaFormResult,
} from '@/features/note/domain/note';
import { MEDIA_MAX_BYTES, MEDIA_TYPES, type MediaRejection } from '@/shared/domain/media';

/**
 * note の画像を足すフォームと、足した画像を本文に貼る印の一覧（FR-023、specs/003-note/contracts/dash.md）。
 * 1 回の操作で 1 枚。形式と大きさは共有担当の media-storage.ts が確かめる（research.md の R12）。
 * 印は `media.storage_key` で画像を指し、主キーを出さない（research.md の R11）
 */

type Action = (state: MediaFormResult | null, formData: FormData) => Promise<MediaFormResult>;

type Props = { action: Action; noteUid: string; mediaStorageKeys: string[] };

const MAX_MB = MEDIA_MAX_BYTES / 1024 / 1024;

const ERROR_MESSAGES: Record<MediaRejection, string> = {
  empty: '画像のファイルを選んでください',
  'too-large': `画像は 1 枚 ${MAX_MB} MB までにしてください`,
  'unsupported-type': '画像は JPEG・PNG・WebP・GIF にしてください',
};

const FORBIDDEN = 'オーナーであることを確かめられませんでした。ログインし直してください';

export const NoteMediaForm = ({ action, noteUid, mediaStorageKeys }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const reason = result?.status === 'invalid' ? result.errors[MEDIA_FILE_FIELD] : undefined;
  const message = result?.status === 'forbidden' ? FORBIDDEN : reason && ERROR_MESSAGES[reason];

  return (
    <section aria-labelledby="note-media-heading" className="flex flex-col gap-3">
      <h2 id="note-media-heading" className="text-lg font-bold">
        画像
      </h2>
      {mediaStorageKeys.length === 0 ? (
        <p>足した画像はありません</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            本文に次の印を書くと、画像を置けます。代替テキスト・ホバーで出す文・キャプションを書き換えてください。ホバーで出す文（
            {'"…"'}）とキャプションの行（{'*…*'}）は、要らなければ消せます
          </p>
          <ul className="flex flex-col gap-2">
            {mediaStorageKeys.map((key) => (
              <li key={key}>
                <code className="break-all whitespace-pre-wrap">{mediaMarkOf(key)}</code>
              </li>
            ))}
          </ul>
        </>
      )}
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
        <label className="flex flex-col gap-1">
          <span className="font-bold">画像のファイル</span>
          <span className="text-sm text-muted-foreground">
            JPEG・PNG・WebP・GIF、1 枚 {MAX_MB} MB まで
          </span>
          <input
            type="file"
            name={MEDIA_FILE_FIELD}
            accept={MEDIA_TYPES.join(',')}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        {message && (
          <p role="alert" className="text-destructive">
            {message}
          </p>
        )}
        <div>
          <button
            type="submit"
            className="rounded-md border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            画像を足す
          </button>
        </div>
      </form>
    </section>
  );
};
