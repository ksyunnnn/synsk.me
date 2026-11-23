'use client';

import type { ComponentProps } from 'react';
import { ProjectForm } from '@/features/project/components/project-form';
import { ProjectBodyPreview } from '@/app/dash/projects/_body-preview';

/**
 * 実績の編集のフォームに、本文のプレビュー（実績のページ・職務経歴書の見え方）を渡す。プレビューは
 * 職務経歴書の部品を使い、features をまたぐため app で組み立てる（ADR-0026 の依存の向き）
 */
export const EditProjectForm = (
  props: Omit<ComponentProps<typeof ProjectForm>, 'renderBodyPreview'>,
) => (
  <ProjectForm
    {...props}
    renderBodyPreview={(body, mediaSrc) => <ProjectBodyPreview body={body} mediaSrc={mediaSrc} />}
  />
);
