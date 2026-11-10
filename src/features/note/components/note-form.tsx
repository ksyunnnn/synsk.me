'use client';

import { useActionState } from 'react';
import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  NOTE_UID_FIELD,
  OPENED_REVISION_UID_FIELD,
  type NoteField,
  type NoteFieldError,
  type NoteFormResult,
  type NoteFormValues,
} from '@/features/note/domain/note';
import { DraftRetainingForm } from '@/shared/components/draft-retention';
import { InputField, TextareaField } from '@/shared/components/field';
import { FormActions } from '@/shared/components/form-actions';

/**
 * note を作る・保存するフォーム（specs/003-note/contracts/dash.md）。
 *
 * Server Action は props で受け取る。このファイルは `server/` を読み込まない（ADR-0026 の依存の
 * 向き 3）。`useActionState` に渡した Server Action は、JavaScript なしでもフォームの送信で動く。
 * 失敗の結果は送られた値を持ち、入力を消さずに理由を示す。
 *
 * 書きかけは `DraftRetainingForm` がその端末に持つ（FR-018・FR-019、research.md の R10）。
 * 編集の画面は、開いたときの最も新しい版の uid を `version` に渡す。
 *
 * 入力の決まりはサーバで確かめ、誤りを文言で返す。`required` と `maxLength` を付けない。
 * ブラウザが送信を止めると、どの項目の何が合わないかを同じ形で伝えられないため
 */

type NoteFormAction = (state: NoteFormResult | null, formData: FormData) => Promise<NoteFormResult>;

type Props = {
  action: NoteFormAction;
  initialValues: NoteFormValues;
  /**
   * 編集する note。持てば編集のフォームで、uid と開いた版の uid を送る。一度でも公開した note は
   * 識別子を読み取りだけで出す（FR-003）
   */
  note?: { uid: string; openedRevisionUid: string; hasBeenPublished: boolean };
};

const ERROR_MESSAGES: Record<NoteField, Partial<Record<NoteFieldError, string>>> = {
  slug: {
    missing: '識別子を入力してください',
    invalid: '識別子は英小文字・数字・ハイフンで、100 文字までにしてください',
    'slug-taken': 'この識別子はほかの note が使っています。削除した note の識別子も使えません',
    'slug-locked': '一度でも公開した note の識別子は変えられません',
  },
  title: {
    missing: '公開するには題を入力してください',
    'too-long': `題は ${NOTE_TITLE_MAX_LENGTH} 文字までにしてください`,
  },
  description: {},
  body: {
    'too-long': `本文は ${NOTE_BODY_MAX_LENGTH.toLocaleString('ja-JP')} 文字までにしてください`,
  },
};

const RESULT_MESSAGES = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
  conflict:
    'この note は、開いた後に別の画面で保存されていました。保存していません。入力した内容は残っています。別の画面で保存した内容を確かめてから入力し直してください',
} as const;

export const NoteForm = ({ action, initialValues, note }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const values: NoteFormValues =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: NoteField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  return (
    <DraftRetainingForm
      action={formAction}
      storageKey={`note:${note?.uid ?? 'new'}`}
      version={note?.openedRevisionUid}
      result={result}
      className="flex flex-col gap-6"
    >
      {note && (
        <>
          <input type="hidden" name={NOTE_UID_FIELD} value={note.uid} />
          <input type="hidden" name={OPENED_REVISION_UID_FIELD} value={note.openedRevisionUid} />
        </>
      )}

      {result && result.status !== 'saved' && (
        <p role="alert" className="text-destructive">
          {RESULT_MESSAGES[result.status]}
        </p>
      )}

      {note?.hasBeenPublished ? (
        // 入力の欄にしない。欄にすると、公開する前に書きかけた識別子が欄と書きかけに残り、
        // 読み取りだけの欄から直せないまま送られる。送る値は隠しフィールドで、書きかけに持たない
        <div className="flex flex-col gap-1">
          <p className="font-bold">識別子</p>
          <p className="text-sm text-muted-foreground">
            一度でも公開した note の識別子は変えられません
          </p>
          <p>{initialValues.slug}</p>
          <input type="hidden" name="slug" value={initialValues.slug} />
          {errorOf('slug') && <p className="text-sm text-destructive">{errorOf('slug')}</p>}
        </div>
      ) : (
        <InputField
          name="slug"
          label="識別子"
          hint="URL に出ます。英小文字・数字・ハイフンで、100 文字まで。公開した後は変えられません"
          defaultValue={values.slug}
          autoComplete="off"
          error={errorOf('slug')}
        />
      )}
      <InputField
        name="title"
        label="題"
        hint="下書きは題が空でも保存できます。公開するには題が要ります"
        defaultValue={values.title}
        autoComplete="off"
        error={errorOf('title')}
      />
      <TextareaField
        name="description"
        label="説明文"
        hint="空にすると、「説明文が空のとき」で選んだ説明を出します"
        rows={3}
        defaultValue={values.description}
        error={errorOf('description')}
      />
      <TextareaField
        name="body"
        label="本文"
        hint="Markdown で書きます。HTML は要素になりません"
        rows={16}
        defaultValue={values.body}
        error={errorOf('body')}
      />

      <FormActions>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {note ? '保存する' : '作る'}
        </button>
      </FormActions>
    </DraftRetainingForm>
  );
};
