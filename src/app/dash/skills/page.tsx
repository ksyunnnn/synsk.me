import type { Metadata } from 'next';
import { NO_PROJECT_FILTER } from '@/features/project/domain/project';
import { listProjects } from '@/features/project/server/queries';
import type { SkillSummary } from '@/features/skill/domain/skill';
import { listSkills } from '@/features/skill/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  SplitView,
  withParam,
} from '@/shared/components/split-view';
import { firstParam } from '@/shared/domain/search-param';
import { routes } from '@/shared/routes';
import { formatMonths, SkillDetail } from './_detail';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'スキル | synsk.me' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** スキルの Split view。シングルには、つながる実績と経験年数を出す（#366 の明文化） */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = { selected: firstParam(raw.selected) };
  // オーナーでなければ、読む前に 403 になる
  const [skills, { projects }] = await Promise.all([listSkills(), listProjects(NO_PROJECT_FILTER)]);
  const selected = params.selected ?? null;
  const link = (changes: Record<string, string | null>) =>
    withParam(routes.dash.skills.list, params, changes);
  const projectCountOf = (summary: SkillSummary | undefined) =>
    summary === undefined ? 0 : projects.filter((p) => p.skillIds.includes(summary.id)).length;
  const selectedSummary = skills.find((s) => s.uid === selected);

  const collection = (
    <>
      <CollectionToolbar
        title="スキル"
        summary={`${skills.length} 件`}
        action={{ href: routes.dash.skills.new, label: '追加' }}
      />
      {firstParam(raw.deleted) === '1' && (
        <SavedNotice flags={['deleted']} className="px-5 pb-2">
          スキルを削除しました
        </SavedNotice>
      )}
      {skills.length === 0 ? (
        <CollectionEmpty>登録したスキルはありません</CollectionEmpty>
      ) : (
        <CollectionTable
          rows={skills}
          rowKey={(s) => s.uid}
          rowHref={(s) => link({ selected: s.uid })}
          selectedKey={selected}
          draftKey={(s) => `skill:${s.uid}`}
          columns={[
            { header: '名前', cell: (s) => s.name },
            {
              header: '経験年数',
              cell: (s) =>
                `${formatMonths(s.experienceMonths)}${s.monthsOverride !== null ? '（上書き）' : ''}`,
              nowrap: true,
            },
            {
              header: '実績の数',
              cell: (s) => `${projectCountOf(s)} 件`,
              nowrap: true,
              muted: true,
            },
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
      detailLabel="選んだスキル"
      detail={
        selected && (
          <SkillDetail
            uid={selected}
            summary={selectedSummary}
            projectCount={projectCountOf(selectedSummary)}
            flags={{ saved: firstParam(raw.saved) }}
          />
        )
      }
    />
  );
};

export default Page;
