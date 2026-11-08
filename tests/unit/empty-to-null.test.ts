import { describe, expect, it } from 'vitest';
import {
  parseEducationContent,
  toEducationFormValues,
} from '@/features/education/domain/education';
import { parseResumeEducation } from '@/features/resume/domain/resume-forms';
import { emptyToNull } from '@/shared/domain/empty-to-null';

/**
 * 空にできる入力の読み替え（src/shared/domain/empty-to-null.ts）。学歴と写した学歴は、同じ
 * 入力から同じ学部と備考を保存する（specs/002-resume/spec.md の FR-031）
 */

describe('emptyToNull', () => {
  it('空と空白だけの値は null', () => {
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull(' \n\t')).toBeNull();
  });

  it('それ以外は前後の空白を残して返す', () => {
    expect(emptyToNull('  作り物  ')).toBe('  作り物  ');
  });
});

describe('学歴と写した学歴の学部と備考', () => {
  const values = {
    ...toEducationFormValues(),
    school: '作り物大学',
    department: '  作り物学部  ',
    startedOn: '2014-04-01',
    remarks: '  1 行目\r\n  2 行目  ',
  };

  it('学部は前後の空白を落とし、備考は改行だけをそろえて前後の空白を残す', () => {
    const parsed = parseEducationContent(values);
    expect(parsed).toMatchObject({
      ok: true,
      content: { department: '作り物学部', remarks: '  1 行目\n  2 行目  ' },
    });
  });

  it('写した学歴も同じ値を保存する', () => {
    const education = parseEducationContent(values);
    const copied = parseResumeEducation(values);
    if (!education.ok || !copied.ok) throw new Error('入力を読めなかった');
    expect(copied.content.department).toBe(education.content.department);
    expect(copied.content.remarks).toBe(education.content.remarks);
  });

  it('空白だけの学部と備考は null', () => {
    expect(parseEducationContent({ ...values, department: '  ', remarks: '\n' })).toMatchObject({
      ok: true,
      content: { department: null, remarks: null },
    });
  });
});
