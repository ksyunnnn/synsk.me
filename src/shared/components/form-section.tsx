import type { ReactNode } from 'react';

const SEPARATED = 'flex flex-col gap-4 border-t border-border pt-8';

/**
 * 管理画面の 1 つの画面に並ぶ、別々に送るフォームの区切り。上に線と余白を置き、どの操作が
 * どのフォームに属するかを見て分かるようにする（HIG の Layout、WCAG 2.2 SC 1.3.1）。
 *
 * `title` を渡すと、見出しを持つ `section` にする。中身が自分の見出しを持つときは渡さず、
 * 線と余白だけを置く。`id` は見出しの要素の id で、画面の中で重ならない値にする
 */
export const FormSection = ({
  title,
  id,
  children,
}: { children: ReactNode } & (
  { title: string; id: string } | { title?: undefined; id?: undefined }
)) =>
  title === undefined ? (
    <div className={SEPARATED}>{children}</div>
  ) : (
    <section aria-labelledby={id} className={SEPARATED}>
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
