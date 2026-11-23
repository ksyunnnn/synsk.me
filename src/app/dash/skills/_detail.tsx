import { SkillForm } from '@/features/skill/components/skill-form';
import { toSkillFormValues, type SkillSummary } from '@/features/skill/domain/skill';
import { editSkill } from '@/features/skill/server/actions';
import { getSkillForEdit } from '@/features/skill/server/queries';
import { DetailFacts } from '@/shared/components/detail-facts';
import { SavedNotice } from '@/shared/components/saved-notice';
import { DetailBody } from '@/shared/components/split-view';
import { TextLink } from '@/shared/components/text-link';
import { toYearsAndMonths } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

/** 経験年数を年と月で表す（FR-033。例: 5 年 11 か月）。一覧の画面も使う */
export const formatMonths = (months: number) => {
  const { years, months: rest } = toYearsAndMonths(months);
  return `${years} 年 ${rest} か月`;
};

/**
 * スキルのシングル。つながる実績と経験年数を出す（#366 の明文化）。`summary` と
 * `projectCount` は、一覧の画面が読んだ値を受け取る
 */
export const SkillDetail = async ({
  uid,
  summary,
  projectCount,
  flags,
}: {
  uid: string;
  summary: SkillSummary | undefined;
  projectCount: number;
  flags: Record<string, string | undefined>;
}) => {
  const skill = await getSkillForEdit(uid);
  if (!skill || !summary)
    return <p className="py-12 text-center text-muted-foreground">このスキルはありません</p>;
  const saved = flags.saved || null;
  return (
    <DetailBody
      title={skill.name}
      draftKey={`skill:${uid}`}
      notice={
        // 印の値は、登録では `1`、編集では保存した時刻。保存のたびに知らせとフォームを置き直す
        saved && (
          <SavedNotice key={saved} flags={['saved']}>
            保存しました
          </SavedNotice>
        )
      }
      form={
        <SkillForm
          key={`${uid}:${saved ?? ''}`}
          action={editSkill}
          initialValues={toSkillFormValues(skill)}
          skillUid={uid}
        />
      }
      relations={
        <DetailFacts
          facts={[
            { label: '経験年数', value: formatMonths(summary.experienceMonths) },
            { label: '実績の期間から求めた値', value: formatMonths(summary.computedMonths) },
            {
              label: 'つながる実績',
              value:
                projectCount === 0 ? (
                  'なし'
                ) : (
                  <TextLink
                    href={routes.dash.projects.listBy({
                      kind: null,
                      organizationUid: null,
                      skillUid: uid,
                      view: 'timeline',
                    })}
                  >
                    {projectCount} 件を時系列で見る
                  </TextLink>
                ),
            },
          ]}
        />
      }
      deletion={{ href: routes.dash.skills.delete(uid), label: 'このスキルを削除する' }}
    />
  );
};
