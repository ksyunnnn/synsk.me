// mock-data.json から timeline の行を作る。D1 の表から一覧を作るときと同じ規則で並べる。
// #166 で D1 から読む形に置き換える
import data from './mock-data.json';

export type TimelineEntry = {
  key: string;
  // 出どころ。note・project・career は表の名前、activity は activity.source の値
  label: string;
  // activity は activity_source.kind、project は project.kind。note と career は持たない
  kind: string | null;
  // 並びの値。日時か暦の日付を文字列のまま比べる。暦の日付は同じ日の日時より前に並ぶ
  sortAt: string;
  title: string;
  // 職歴と実績の組織名
  organization: string | null;
  description: string | null;
  imageUrl: string | null;
  href: string | null;
};

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
      return {
        key: `note-${n.id}`,
        label: 'note',
        kind: null,
        sortAt: n.published_at as string,
        title: revision?.title ?? '',
        organization: null,
        description: revision?.description ?? null,
        imageUrl: n.card_image === 'media' ? mediaUrl(n.card_media_id) : null,
        href: null,
      };
    });

  const projects = data.project.map((p): TimelineEntry => {
    const masked = p.is_masked === 1;
    return {
      key: `project-${p.id}`,
      label: 'project',
      kind: p.kind,
      sortAt: p.started_on,
      title: masked ? p.title_masked : p.title,
      organization: organizationName(p.organization_id, masked),
      description: masked ? null : p.description,
      imageUrl: mediaUrl(p.card_media_id),
      href: p.url,
    };
  });

  const careers = data.career.map((c): TimelineEntry => {
    const masked = c.is_masked === 1;
    return {
      key: `career-${c.id}`,
      label: 'career',
      kind: null,
      sortAt: c.started_on,
      title: c.role,
      organization: organizationName(c.organization_id, masked),
      description: masked ? null : c.description,
      imageUrl: null,
      href: c.url,
    };
  });

  const activities = data.activity
    .filter((a) => a.url === null || !syndicated.has(a.url))
    .map((a): TimelineEntry => {
      const isLifeEvent = a.source === 'life_event';
      return {
        key: `activity-${a.id}`,
        label: a.source,
        kind: data.activity_source.find((s) => s.source === a.source)?.kind ?? null,
        sortAt: (a.published_at ?? a.happened_on) as string,
        title: a.title ?? '',
        organization: null,
        description: a.description,
        imageUrl: isLifeEvent ? mediaUrl(a.card_media_id) : a.image_url,
        href: a.url,
      };
    });

  return [...notes, ...projects, ...careers, ...activities].sort((a, b) =>
    a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0,
  );
};
