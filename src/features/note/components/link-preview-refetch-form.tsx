'use client';

import { useActionState } from 'react';
import {
  LINK_PREVIEW_URL_FIELD,
  NOTE_UID_FIELD,
  type LinkPreviewRefetchError,
  type LinkPreviewRefetchFormResult,
} from '@/features/note/domain/note';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * URL カードの「取り直す」（User Story 6 の 3、FR-029、specs/003-note/contracts/dash.md）。見た目の
 * 確認の画面が URL だけの段落ごとに置く。取れなかったときは、そのカードのすぐ下に何が取れなかった
 * かを出す（design/guidelines.md の Feedback）
 */

type Action = (
  state: LinkPreviewRefetchFormResult | null,
  formData: FormData,
) => Promise<LinkPreviewRefetchFormResult>;

type Props = { action: Action; noteUid: string; url: string };

const REASONS: Record<LinkPreviewRefetchError, string> = {
  'not-in-body': 'この URL は最も新しい版の本文にありません',
  blocked: '内部のアドレスなど、取りに行かない URL です',
  http: '参照先が正常な応答を返しませんでした',
  network: '参照先につながりませんでした',
  timeout: '参照先が 3 秒のうちに応えませんでした',
  'too-many-redirects': '参照先の転送が 2 回を超えました',
};

const messageOf = (result: LinkPreviewRefetchFormResult | null): string | null => {
  if (result?.status === 'forbidden')
    return 'オーナーであることを確かめられませんでした。ログインし直してください';
  if (result?.status !== 'invalid') return null;
  const reason = REASONS[result.errors[LINK_PREVIEW_URL_FIELD] ?? 'network'];
  return `取り直せませんでした。${reason}。表示は取り直す前のままです`;
};

export const LinkPreviewRefetchForm = ({ action, noteUid, url }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const message = messageOf(result);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
      <input type="hidden" name={LINK_PREVIEW_URL_FIELD} value={url} />
      <SubmitButton className="rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        取り直す
      </SubmitButton>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </form>
  );
};
