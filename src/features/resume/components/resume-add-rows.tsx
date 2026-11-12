import { ResumeAddRowsForm } from '@/features/resume/components/resume-add-rows-form';
import { toSourceOptions } from '@/features/resume/components/resume-source-fieldset';
import {
  copiedSourceIds,
  type ResumeForEdit,
  type ResumeRowKind,
  type ResumeSources,
} from '@/features/resume/domain/resume';
import { DashPage } from '@/shared/components/dash-page';
import { routes } from '@/shared/routes';

/**
 * 作ったあとに職歴・実績・学歴を足す画面の中身（specs/002-resume/contracts/dash.md の
 * `/dash/resumes/{uid}/<種類>/new`、FR-041）。既に写した写し元は選択肢に出さない
 * （research.md の R14）。フォームには選択肢の名前だけを渡し、本文や関連 URL を渡さない
 */

const RESUME_ROW_KIND_LABELS: Record<ResumeRowKind, string> = {
  careers: '職歴',
  projects: '実績',
  educations: '学歴',
};

export const ResumeAddRows = ({
  resume,
  sources,
  kind,
  action,
}: {
  resume: ResumeForEdit;
  sources: ResumeSources;
  kind: ResumeRowKind;
  action: Parameters<typeof ResumeAddRowsForm>[0]['action'];
}) => {
  const label = RESUME_ROW_KIND_LABELS[kind];
  const copied = copiedSourceIds(resume, kind);
  const options = toSourceOptions(sources)[kind].filter((option) => !copied.has(option.id));

  return (
    <DashPage
      back={{ href: routes.dash.resumes.row(resume.uid), label: '設定の画面へ戻る' }}
      title={<>{label}を足す</>}
    >
      <p className="text-sm text-muted-foreground">
        選んだ{label}を、元の値で写します。写した後に元を直しても変わりません
      </p>
      <ResumeAddRowsForm
        key={resume.updatedAt}
        action={action}
        kind={kind}
        legend={label}
        options={options}
        resumeUid={resume.uid}
        updatedAt={resume.updatedAt}
      />
    </DashPage>
  );
};
