// mock-data.json から timeline の行を作る。D1 の表から一覧を作るときと同じ規則で並べる。
// #166 で D1 から読む形に置き換える
import data from './mock-data.json';

export type EntryKind = 'note' | 'project' | 'career' | 'article' | 'life_event';

export type TimelineEntry = {
  key: string;
  kind: EntryKind;
  // 並びの値。日時か暦の日付を文字列のまま比べる。暦の日付は同じ日の日時より前に並ぶ
  sortAt: string;
  // 表示する日付（YYYY-MM-DD、日本時間）
  date: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  href: string | null;
  // 記事の出どころ（zenn_article など）
  source: string | null;
};

const toJstDate = (value: string) =>
  value.length === 10
    ? value
    : new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

// モックに限り、media.storage_key は画像の URL を持つ
const mediaUrl = (id: number | null) =>
  id === null ? null : (data.media.find((m) => m.id === id)?.storage_key ?? null);

const organizationName = (id: number, masked: boolean) => {
  const organization = data.organization.find((o) => o.id === id);
  if (!organization) return '';
  return masked ? organization.name_masked : organization.name;
};

export const getTimeline = (): TimelineEntry[] => {
  const syndicated = new Set(data.syndication.map((s) => s.url));

  const notes = data.note
    .filter((n) => n.status === 'published' && n.deleted_at === null && n.published_at !== null)
    .map((n): TimelineEntry => {
      const revision = data.note_revision.find((r) => r.id === n.published_revision_id);
      const publishedAt = n.published_at as string;
      return {
        key: `note-${n.id}`,
        kind: 'note',
        sortAt: publishedAt,
        date: toJstDate(publishedAt),
        title: revision?.title ?? '',
        description: revision?.description ?? null,
        imageUrl: n.card_image === 'media' ? mediaUrl(n.card_media_id) : null,
        href: null,
        source: null,
      };
    });

  const projects = data.project.map((p): TimelineEntry => {
    const masked = p.is_masked === 1;
    return {
      key: `project-${p.id}`,
      kind: 'project',
      sortAt: p.started_on,
      date: p.started_on,
      title: `${masked ? p.title_masked : p.title}（${organizationName(p.organization_id, masked)}）`,
      description: masked ? null : p.description,
      imageUrl: mediaUrl(p.card_media_id),
      href: p.url,
      source: null,
    };
  });

  const careers = data.career.map((c): TimelineEntry => {
    const masked = c.is_masked === 1;
    return {
      key: `career-${c.id}`,
      kind: 'career',
      sortAt: c.started_on,
      date: c.started_on,
      title: `${organizationName(c.organization_id, masked)}・${c.role}`,
      description: masked ? null : c.description,
      imageUrl: null,
      href: c.url,
      source: null,
    };
  });

  const activities = data.activity
    .filter((a) => a.url === null || !syndicated.has(a.url))
    .map((a): TimelineEntry => {
      const sortAt = (a.published_at ?? a.happened_on) as string;
      const isLifeEvent = a.source === 'life_event';
      return {
        key: `activity-${a.id}`,
        kind: isLifeEvent ? 'life_event' : 'article',
        sortAt,
        date: toJstDate(sortAt),
        title: a.title ?? '',
        description: a.description,
        imageUrl: isLifeEvent ? mediaUrl(a.card_media_id) : a.image_url,
        href: a.url,
        source: isLifeEvent ? null : a.source,
      };
    });

  return [...notes, ...projects, ...careers, ...activities].sort((a, b) =>
    a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0,
  );
};
