'use client';

import { useActionState, type ReactNode } from 'react';
import { mediaMarkOf } from '@/shared/domain/markdown';
import {
  MEDIA_FILE_FIELD,
  MEDIA_MAX_BYTES,
  MEDIA_STORAGE_FULL_MESSAGE,
  MEDIA_TYPES,
  type MediaFormResult,
  type MediaRejection,
} from '@/shared/domain/media';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * 本文の画像を足すフォームと、足した画像を本文に貼る印の一覧。1 回の操作で 1 枚
 * （specs/003-note/research.md の R12）。形式と大きさと置き場の総量は media-storage.ts が確かめる。
 * 使い手は 001 の実績・職歴（FR-027）。Server Action は props で受け取る（ADR-0026 の依存の向き 3）
 */

type Action = (state: MediaFormResult | null, formData: FormData) => Promise<MediaFormResult>;

type Props = {
  action: Action;
  /** 持ち主を指す、フォームが送る値（例: `projectUid` とその uid） */
  owner: { field: string; uid: string };
  mediaStorageKeys: string[];
  /** フォームに足す入力（例: 代表画像にもするかのチェックボックス） */
  children?: ReactNode;
};

const MAX_MB = MEDIA_MAX_BYTES / 1024 / 1024;

const ERROR_MESSAGES: Record<MediaRejection, string> = {
  empty: '画像のファイルを選んでください',
  'too-large': `画像は 1 枚 ${MAX_MB} MB までにしてください`,
  'unsupported-type': '画像は JPEG・PNG・WebP・GIF にしてください',
  'storage-full': MEDIA_STORAGE_FULL_MESSAGE,
};

const FORBIDDEN = 'オーナーであることを確かめられませんでした。ログインし直してください';

export const MediaUploadForm = ({ action, owner, mediaStorageKeys, children }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const reason = result?.status === 'invalid' ? result.errors[MEDIA_FILE_FIELD] : undefined;
  const message = result?.status === 'forbidden' ? FORBIDDEN : reason && ERROR_MESSAGES[reason];

  return (
    <section aria-labelledby="media-upload-heading" className="flex flex-col gap-3">
      <h2 id="media-upload-heading" className="text-lg font-bold">
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
        <input type="hidden" name={owner.field} value={owner.uid} />
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
        {children}
        {message && (
          <p role="alert" className="text-destructive">
            {message}
          </p>
        )}
        <div>
          <SubmitButton className="rounded-md border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            画像を足す
          </SubmitButton>
        </div>
      </form>
    </section>
  );
};
