import { MAX_COPIED_ROWS } from '@/features/resume/domain/build-resume';
import type { ResumeRowKind, ResumeSources } from '@/features/resume/domain/resume';
import { CheckboxField } from '@/shared/components/field';
import { formatPeriod } from '@/shared/domain/period';

/**
 * 写し元の職歴・実績・学歴を選ぶチェックボックス。作成の画面（`/dash/resumes/new`）と、作ったあとに
 * 足す画面（`/dash/resumes/{uid}/<種類>/new`、FR-041）が使う（specs/002-resume/contracts/dash.md）
 */

export type SourceOption = { id: number; label: string; detail: string };

/**
 * 写し元を選択肢にする。名前と期間だけを持ち、本文や関連 URL をクライアントの部品に渡さない。
 * 職歴は「組織名・肩書」、実績は題、学歴は学校を名前にする
 */
export const toSourceOptions = (sources: ResumeSources): Record<ResumeRowKind, SourceOption[]> => ({
  careers: sources.careers.map((c) => ({
    id: c.id,
    label: `${c.organizationName}・${c.role}`,
    detail: formatPeriod(c.period),
  })),
  projects: sources.projects.map((p) => ({
    id: p.id,
    label: p.title,
    detail: `${p.organizationName}・${formatPeriod(p.period)}`,
  })),
  educations: sources.educations.map((e) => ({
    id: e.id,
    label: e.school,
    detail: formatPeriod(e.period),
  })),
});

/** 選択の誤りの文言。作成の画面と足す画面で同じ */
export const SELECTION_MESSAGES = {
  invalid: '選んだ項目を読めませんでした。開き直してください',
  'source-missing':
    '選んだ職歴・実績・学歴のうち、開いた後に消えたものがあります。開き直してください',
  'too-many': `一度に写せるのは、職歴・実績・学歴と実績のスキルを合わせて ${MAX_COPIED_ROWS} 行までです。選ぶものを減らしてください`,
} as const;

export const SourceFieldset = ({
  legend,
  name,
  options,
  selected,
  emptyText = '登録したものはありません',
}: {
  legend: string;
  name: string;
  options: SourceOption[];
  /** 選んだ状態で出す id。null ならすべて選ぶ */
  selected: string[] | null;
  /** 選択肢が無いときの文言 */
  emptyText?: string;
}) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="font-bold">{legend}</legend>
    {options.length === 0 ? (
      <p className="text-sm text-muted-foreground">{emptyText}</p>
    ) : (
      options.map((option) => (
        <CheckboxField
          key={option.id}
          name={name}
          value={option.id}
          label={option.label}
          hint={option.detail}
          defaultChecked={selected === null || selected.includes(String(option.id))}
        />
      ))
    )}
  </fieldset>
);
