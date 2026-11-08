'use client';

import { useEffect } from 'react';

/**
 * 開発サーバで開いたタブの題の頭に、起動したディレクトリ名を付ける。
 *
 * 複数のワークツリーで開発サーバを並べたとき、ブラウザのタブから見分けるため。
 * `__WORKSPACE_NAME__` は `vite.config.ts` が埋め込む。空文字のときと、Vite を
 * 通らず未定義のときは何もしない。各ページの metadata には触れず、`<head>` の
 * 変化を見て付け直す。
 */
export const DevTabTitle = () => {
  useEffect(() => {
    const name = typeof __WORKSPACE_NAME__ === 'undefined' ? '' : __WORKSPACE_NAME__;
    if (name === '') return;
    const prefix = `[${name}] `;
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
