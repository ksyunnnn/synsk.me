import { SourceStatusPanel } from '@/components/timeline/SourceStatusPanel';
import { fetchAllSources, groupByYear, mergeEntries } from '@/lib/timeline/registry';
import { TIMELINE_SOURCES } from '@/lib/timeline/sources';

// 外部 API の応答をその場で確かめるためのページなので、事前生成しない。
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Timeline — lab',
  robots: { index: false, follow: false },
};

const Page = async () => {
  const results = await fetchAllSources(TIMELINE_SOURCES);
  const groups = groupByYear(mergeEntries(results));
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="mb-2 text-2xl font-bold">Timeline</h1>
      <p className="mb-12 text-sm text-muted-foreground">
        外部プラットフォームの取得可否を確かめる検証用ページ。{total} 件を時系列に並べる。
      </p>

      <SourceStatusPanel results={results} />

      <ol className="space-y-10">
        {groups.map((group) => (
          <li key={group.year}>
            <h2 className="mb-3 text-sm font-bold text-muted-foreground">{group.year}</h2>
            <ol className="space-y-3">
              {group.entries.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <span className="mr-2 text-xs text-muted-foreground">{entry.platform}</span>
                  <a href={entry.url} className="underline" target="_blank" rel="noreferrer">
                    {entry.title}
                  </a>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </main>
  );
};

export default Page;
