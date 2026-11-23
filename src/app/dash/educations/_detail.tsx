import { EducationForm } from '@/features/education/components/education-form';
import { toEducationFormValues } from '@/features/education/domain/education';
import { editEducation } from '@/features/education/server/actions';
import { getEducationForEdit } from '@/features/education/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import { DetailBody } from '@/shared/components/split-view';
import { routes } from '@/shared/routes';

/** 学歴のシングル（#366 の明文化） */
export const EducationDetail = async ({
  uid,
  flags,
}: {
  uid: string;
  flags: Record<string, string | undefined>;
}) => {
  const education = await getEducationForEdit(uid);
  if (!education)
    return <p className="py-12 text-center text-muted-foreground">この学歴はありません</p>;
  const saved = flags.saved || null;
  return (
    <DetailBody
      title={`${education.school}${education.department ? `・${education.department}` : ''}`}
      draftKey={`education:${education.uid}`}
      notice={
        // 印の値は、登録では `1`、編集では保存した時刻。保存のたびに知らせとフォームを置き直す
        saved && (
          <SavedNotice key={saved} flags={['saved']}>
            保存しました
          </SavedNotice>
        )
      }
      form={
        <EducationForm
          key={`${uid}:${saved ?? ''}`}
          action={editEducation}
          initialValues={toEducationFormValues(education)}
          educationUid={education.uid}
        />
      }
      deletion={{ href: routes.dash.educations.delete(education.uid), label: 'この学歴を削除する' }}
    />
  );
};
