/**
 * 実績の種類と表示名（specs/001-career-and-project/spec.md の FR-012、ADR-0055）。オーナーがその実績で
 * 何をしたかで分ける。`project.kind` と `resume_project.kind` の CHECK と同じ値を、ここ 1 か所に置く。
 * 順は入力の選択肢の順。使い手は 001 の実績、002 の写した実績、005 の一覧
 */
export const PROJECT_KINDS = ['develop', 'host', 'talk', 'other'] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  develop: '開発',
  host: '主催',
  talk: '登壇',
  other: 'その他',
};

export const isProjectKind = (value: string): value is ProjectKind =>
  (PROJECT_KINDS as readonly string[]).includes(value);
