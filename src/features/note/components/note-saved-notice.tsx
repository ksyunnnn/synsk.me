'use client';

import { DraftSavedNotice } from '@/shared/components/draft-retention';

/**
 * 保存できたことの知らせ。続けて保存すると同じ `?saved=1` の画面へ移り、`DraftSavedNotice` が
 * 置き直されず、送った書きかけを消さない。保存した版の uid ごとに置き直す
 */
export const NoteSavedNotice = ({ revisionUid }: { revisionUid: string }) => (
  <DraftSavedNotice key={revisionUid} />
);
