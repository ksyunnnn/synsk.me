import type { ReactNode } from 'react';

/**
 * フォームの項目のまとまり。見出しで区切り、まとまりの中の項目を縦に並べる。階層は配置と
 * まとまりで表す（WWDC25 Get to know the new design system）
 */
export const FormGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-4">
    <h3 className="text-caption font-medium text-muted-foreground">{title}</h3>
    {children}
  </section>
);

/** オンとオフの設定を 1 つの面に並べる。行の間に線を引く */
export const SettingsGroup = ({ children }: { children: ReactNode }) => (
  <div className="divide-y divide-border rounded-2xl bg-muted/50 px-4">{children}</div>
);
