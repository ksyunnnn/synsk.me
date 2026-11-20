import type { Metadata } from 'next';
import { listProjects } from '@/features/project/server/queries';
import { SkillForm } from '@/features/skill/components/skill-form';
import { toSkillFormValues } from '@/features/skill/domain/skill';
import { editSkill } from '@/features/skill/server/actions';
import { getSkillForEdit, listSkills } from '@/features/skill/server/queries';
import { DetailFacts } from '@/shared/components/detail-facts';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  DetailHeading,
  SplitView,
  withParam,
} from '@/shared/components/split-view';
import { TextLink } from '@/shared/components/text-link';
import { toYearsAndMonths } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'スキル | synsk.me' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** 経験年数を年と月で表す（FR-033。例: 5 年 11 か月） */
const formatMonths = (months: number) => {
  const { years, months: rest } = toYearsAndMonths(months);
  return `${years} 年 ${rest} か月`;
};

const NO_FILTER = { kind: null, organizationUid: null, status: null, isMasked: null };

/** スキルの Split view。シングルには、つながる実績と経験年数を出す（#366 の明文化） */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = { selected: first(raw.selected) };
  // オーナーでなければ、読む前に 403 になる
  const [skills, { projects }] = await Promise.all([listSkills(), listProjects(NO_FILTER)]);
  const selected = params.selected ?? null;
  const link = (changes: Record<string, string | null>) =>
    withParam(routes.dash.skills.list, params, changes);

  const collection = (
    <>
      <CollectionToolbar
        title="スキル"
        summary={`${skills.length} 件`}
        action={{ href: routes.dash.skills.new, label: '追加' }}
      />
      {first(raw.deleted) === '1' && (
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
              cell: (s) => `${projects.filter((p) => p.skillIds.includes(s.id)).length} 件`,
              nowrap: true,
              muted: true,
            },
          ]}
        />
      )}
    </>
  );

  const detail = async (uid: string) => {
    const [skill, summary] = [await getSkillForEdit(uid), skills.find((s) => s.uid === uid)];
    if (!skill || !summary)
      return <p className="py-12 text-center text-muted-foreground">このスキルはありません</p>;
    const own = projects.filter((p) => p.skillIds.includes(summary.id));
    return (
      <div className="flex flex-col gap-6">
        <DetailHeading title={skill.name} draftKey={`skill:${uid}`}>
          <DetailFacts
            facts={[
              { label: '経験年数', value: formatMonths(summary.experienceMonths) },
              { label: '実績の期間から求めた値', value: formatMonths(summary.computedMonths) },
              {
                label: 'つながる実績',
                value:
                  own.length === 0 ? (
                    'なし'
                  ) : (
                    <TextLink href={`${routes.dash.projects.list}?skill=${uid}&view=timeline`}>
                      {own.length} 件を時系列で見る
                    </TextLink>
                  ),
              },
            ]}
          />
        </DetailHeading>
        {first(raw.saved) === '1' && <SavedNotice flags={['saved']}>保存しました</SavedNotice>}
        <SkillForm
          key={uid}
          action={editSkill}
          initialValues={toSkillFormValues(skill)}
          skillUid={uid}
        />
        <p className="border-t border-border pt-6 text-small">
          <TextLink href={routes.dash.skills.delete(uid)}>このスキルを削除する</TextLink>
        </p>
      </div>
    );
  };

  return (
    <SplitView
      collection={collection}
      selected={selected !== null}
      closeHref={link({ selected: null })}
      detailLabel="選んだスキル"
      detail={selected && (await detail(selected))}
    />
  );
};

export default Page;
