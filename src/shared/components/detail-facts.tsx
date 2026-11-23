import type { ReactNode } from 'react';

/**
 * シングルに添える、計算で決まる関係や値。表示だけで、ここでは直さない（#366 の明文化の
 * 「2. ビュー」）
 */
export const DetailFacts = ({ facts }: { facts: { label: string; value: ReactNode }[] }) => (
  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-small">
    {facts.map((fact) => (
      <div key={fact.label} className="contents">
        <dt className="text-muted-foreground">{fact.label}</dt>
        <dd>{fact.value}</dd>
      </div>
    ))}
  </dl>
);
