import type { SourceResult, SourceStatus } from '@/lib/timeline/types';

const STATUS_LABEL: Record<SourceStatus, string> = {
  ok: '実 API から取得',
  fixture: '記録済みレスポンス',
  unavailable: '取得手段なし',
  error: '取得失敗',
};

const STATUS_STYLE: Record<SourceStatus, string> = {
  ok: 'bg-foreground text-background',
  fixture: 'bg-muted text-muted-foreground',
  unavailable: 'bg-muted text-muted-foreground',
  error: 'bg-destructive text-destructive-foreground',
};

/**
 * source ごとの取得結果を並べる。
 * 「どのプラットフォームが実 API まで到達したか」をページ上で読めるようにする。
 */
export const SourceStatusPanel = ({ results }: { results: SourceResult[] }) => {
  const okCount = results.filter((result) => result.status === 'ok').length;

  return (
    <section aria-labelledby="source-status-heading" className="mb-16">
      <h2 id="source-status-heading" className="mb-1 text-sm font-bold tracking-wide uppercase">
        Sources
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {results.length} 件中 {okCount} 件が実 API から取得
      </p>

      <ul className="divide-y divide-border border-y border-border">
        {results.map((result) => (
          <li key={result.platform} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
            <span className="w-24 shrink-0 text-sm font-bold">{result.platform}</span>
            <span
              className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] leading-none ${STATUS_STYLE[result.status]}`}
            >
              {STATUS_LABEL[result.status]}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {result.entries.length} 件
            </span>
            <p className="w-full text-xs leading-relaxed text-muted-foreground">
              {result.note}
              {result.requiredEnv && result.requiredEnv.length > 0 ? (
                <span className="ml-1 font-mono">[{result.requiredEnv.join(', ')}]</span>
              ) : null}
              {result.reference ? (
                <>
                  {' '}
                  <a
                    href={result.reference}
                    className="underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    target="_blank"
                    rel="noreferrer"
                  >
                    出典
                  </a>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};
