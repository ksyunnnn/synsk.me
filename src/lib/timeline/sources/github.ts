import { fetchJson, PER_SOURCE_LIMIT } from '../registry';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/** 未認証は 60 req/h/IP。Workers は共有 IP から出るため GITHUB_TOKEN の併用を勧める。 */
const ENDPOINT = 'https://api.github.com/users/ksyunnnn/repos?sort=pushed&per_page=30';
const REFERENCE = 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  archived: boolean;
  fork: boolean;
  /** コミットが 1 つも無いリポジトリでは null になる。 */
  pushed_at: string | null;
  created_at: string;
}

export const githubSource: TimelineSource = {
  platform: 'github',
  label: 'GitHub',
  fetch: async (): Promise<SourceResult> => {
    const token = process.env.GITHUB_TOKEN;
    const response = await fetchJson<GitHubRepo[]>(ENDPOINT, {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });

    if (!response.ok || response.body === undefined) {
      return {
        platform: 'github',
        status: 'error',
        entries: [],
        note: `取得が ${response.status} で失敗した。未認証は 60 req/h/IP。`,
        reference: REFERENCE,
        requiredEnv: ['GITHUB_TOKEN'],
      };
    }

    const repos = response.body;
    const entries: TimelineEntry[] = repos
      // fork と archived は自分の活動として扱わない。
      .filter((repo) => !repo.fork && !repo.archived)
      .slice(0, PER_SOURCE_LIMIT)
      .map((repo) => ({
        id: `github:${repo.id}`,
        kind: 'repository' as const,
        platform: 'github' as const,
        title: repo.name,
        url: repo.html_url,
        // 「動きがあった日」を時系列の軸に採る。created_at では活動が古い側に固まる。
        // コミットが 1 つも無いと pushed_at が null になり、new Date(null) は
        // Invalid Date ではなく 1970 になるため、created_at へ落とす。
        publishedAt: new Date(repo.pushed_at ?? repo.created_at).toISOString(),
        summary: repo.description ?? undefined,
        // GitHub がリポジトリの OG 画像を返す経路。REST API のドキュメントには無い。
        // 実測: https://opengraph.githubassets.com/1/ksyunnnn/synsk.me → 200 image/png
        thumbnailUrl: `https://opengraph.githubassets.com/1/${repo.full_name}`,
        metrics: [{ label: 'Stars', value: repo.stargazers_count }],
        tags: repo.language ? [repo.language, ...repo.topics] : repo.topics,
      }));

    const limit = response.headers.get('x-ratelimit-limit');
    return {
      platform: 'github',
      status: 'ok',
      entries,
      note: `公式 REST API から取得した（fork と archived を除外）。実測のレート上限は ${limit ?? '不明'} req/h。`,
      reference: REFERENCE,
      requiredEnv: token ? undefined : ['GITHUB_TOKEN'],
    };
  },
};
