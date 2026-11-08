'use client';

import { useEffect } from 'react';

/**
 * 開発サーバで開いたタブの題の頭に、起動したディレクトリ名を付ける。
 *
 * 複数のワークツリーで開発サーバを並べたとき、ブラウザのタブから見分けるため。
 * `__WORKSPACE_NAME__` は `vite.config.ts` が埋め込む。build では空文字になり、
 * 何もしない。各ページの metadata には触れず、`<head>` の変化を見て付け直す。
 */
export const DevTabTitle = () => {
  useEffect(() => {
    if (__WORKSPACE_NAME__ === '') return;
    const prefix = `[${__WORKSPACE_NAME__}] `;
    const apply = () => {
      if (!document.title.startsWith(prefix)) document.title = prefix + document.title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
};
