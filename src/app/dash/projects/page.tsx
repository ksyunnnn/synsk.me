import type { Metadata } from 'next';
import { listCareers } from '@/features/career/server/queries';
import { parseProjectListFilter, type ProjectSummary } from '@/features/project/domain/project';
import { listProjects } from '@/features/project/server/queries';
import { listSkills } from '@/features/skill/server/queries';
import { FilterMenu } from '@/shared/components/filter-menu';
import { PeriodTimeline } from '@/shared/components/period-timeline';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  SplitView,
  ViewSwitch,
  withParam,
} from '@/shared/components/split-view';
import { formatPeriod, toYearsAndMonths } from '@/shared/domain/period';
import { PROJECT_KINDS, PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';
import { SITE_STATUSES, SITE_STATUS_LABELS } from '@/shared/domain/site-status';
import { routes } from '@/shared/routes';
import { ProjectDetail } from './_detail';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績 | synsk.me' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const periodText = (project: ProjectSummary) =>
  `${formatPeriod(project.period)}${project.period.endedOn === null ? '（継続中）' : ''}`;

/**
 * 実績の Split view。左に実績のコレクション（表と縦の時系列）、右に選んだ 1 件のシングル
 * （#366 の明文化）
 */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = {
    kind: first(raw.kind),
    org: first(raw.org),
    status: first(raw.status),
    masked: first(raw.masked),
    skill: first(raw.skill),
    view: first(raw.view),
    selected: first(raw.selected),
  };
  // オーナーでなければ、読む前に 403 になる
  const [{ projects, organizations, filter }, skills, careers] = await Promise.all([
    listProjects(parseProjectListFilter(params)),
    listSkills(),
    listCareers(),
  ]);
  const skill = skills.find((s) => s.uid === params.skill) ?? null;
  const view = params.view === 'timeline' ? 'timeline' : 'table';
  const selected = params.selected ?? null;
  const base = routes.dash.projects.list;
  const link = (changes: Record<string, string | null>) => withParam(base, params, changes);
  const hasSkill = (project: ProjectSummary) =>
    skill === null ? undefined : project.skillIds.includes(skill.id);

  const conditions = [
    filter.organizationUid && organizations.find((o) => o.uid === filter.organizationUid)?.name,
    filter.kind && PROJECT_KIND_LABELS[filter.kind],
    filter.status && SITE_STATUS_LABELS[filter.status],
  ].filter(Boolean);
  const experience = skill && toYearsAndMonths(skill.experienceMonths);
  const summary = [
    `${projects.length} 件`,
    ...conditions,
    skill && experience && `${skill.name} ${experience.years} 年 ${experience.months} か月`,
  ]
    .filter(Boolean)
    .join('・');

  const collection = (
    <>
      <CollectionToolbar
        title="実績"
        summary={summary}
        action={{ href: routes.dash.projects.new, label: '追加' }}
      >
        <ViewSwitch
          options={[
            { label: '表', href: link({ view: null }), current: view === 'table' },
            { label: '時系列', href: link({ view: 'timeline' }), current: view === 'timeline' },
          ]}
        />
      </CollectionToolbar>
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <FilterMenu
          label="組織"
          options={[
            {
              label: 'すべて',
              href: link({ org: null }),
              current: filter.organizationUid === null,
            },
            ...organizations.map((o) => ({
              label: o.name,
              href: link({ org: o.uid }),
              current: filter.organizationUid === o.uid,
            })),
          ]}
        />
        <FilterMenu
          label="種類"
          options={[
            { label: 'すべて', href: link({ kind: null }), current: filter.kind === null },
            ...PROJECT_KINDS.map((kind) => ({
              label: PROJECT_KIND_LABELS[kind],
              href: link({ kind }),
              current: filter.kind === kind,
            })),
          ]}
        />
        {/* スキルは絞らずに目立たせる。前後の実績と見比べられるようにする */}
        <FilterMenu
          label="スキル"
          options={[
            { label: 'すべて', href: link({ skill: null }), current: skill === null },
            ...skills.map((s) => ({
              label: s.name,
              href: link({ skill: s.uid }),
              current: skill?.uid === s.uid,
            })),
          ]}
        />
        <FilterMenu
          label="サイト"
          options={[
            { label: 'すべて', href: link({ status: null }), current: filter.status === null },
            ...SITE_STATUSES.map((status) => ({
              label: SITE_STATUS_LABELS[status],
              href: link({ status }),
              current: filter.status === status,
            })),
          ]}
        />
      </div>
      {first(raw.deleted) === '1' && (
        <SavedNotice flags={['deleted']} className="px-5 pb-2">
          実績を削除しました
        </SavedNotice>
      )}
      {projects.length === 0 ? (
        <CollectionEmpty>
          {conditions.length > 0 ? '条件に合う実績はありません' : '登録した実績はありません'}
        </CollectionEmpty>
      ) : view === 'timeline' ? (
        <PeriodTimeline
          today={new Date().toISOString().slice(0, 10)}
          selectedKey={selected}
          items={projects.map((project) => ({
            key: project.uid,
            href: link({ selected: project.uid }),
            title: project.title,
            meta: `${project.organizationName}・${PROJECT_KIND_LABELS[project.kind]}`,
            period: project.period,
            periodText: periodText(project),
            draftKey: `project:${project.uid}`,
            emphasized: hasSkill(project),
          }))}
          bands={careers
            .filter((career) =>
              projects.some((p) => p.organizationName === career.organizationName),
            )
            .map((career) => ({
              key: career.uid,
              label: `${career.organizationName}・${career.role}`,
              period: career.period,
            }))}
        />
      ) : (
        <CollectionTable
          rows={projects}
          rowKey={(project) => project.uid}
          rowHref={(project) => link({ selected: project.uid })}
          selectedKey={selected}
          draftKey={(project) => `project:${project.uid}`}
          emphasized={skill === null ? undefined : (project) => hasSkill(project) === true}
          columns={[
            { header: '題', cell: (project) => project.title },
            { header: '組織', cell: (project) => project.organizationName, wide: true },
            {
              header: '種類',
              cell: (project) => PROJECT_KIND_LABELS[project.kind],
              nowrap: true,
              wide: true,
            },
            { header: '期間', cell: periodText, nowrap: true, muted: true },
          ]}
        />
      )}
    </>
  );

  return (
    <SplitView
      collection={collection}
      selected={selected !== null}
      closeHref={link({ selected: null })}
      detailLabel="選んだ実績"
      detail={
        selected && (
          <ProjectDetail
            uid={selected}
            flags={{
              saved: first(raw.saved),
              mediaAdded: first(raw.mediaAdded),
              cardImageChanged: first(raw.cardImageChanged),
            }}
          />
        )
      }
    />
  );
};

export default Page;
