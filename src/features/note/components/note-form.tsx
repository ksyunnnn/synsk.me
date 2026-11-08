'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import {
  NOTE_BODY_MAX,
  NOTE_TITLE_MAX,
  NOTE_UID_FIELD,
  OPENED_REVISION_FIELD,
  type NoteField,
  type NoteFieldError,
  type NoteFormResult,
  type NoteFormValues,
} from '@/features/note/domain/note';
import { InputField, TextareaField } from '@/shared/components/field';
import {
  clearDraft,
  draftKey,
  readDraft,
  sameValues,
  writeDraft,
  type NoteDraft,
} from './note-draft';

/**
 * note を作る・保存するフォーム（specs/003-note/contracts/dash.md）。
 *
 * Server Action は props で受け取る（ADR-0026 の依存の向き 3）。`useActionState` に渡した
 * Server Action は、JavaScript なしでもフォームの送信で動く。失敗の結果は送られた値を持ち、
 * 入力を消さずに理由を示す。
 *
 * 書きかけの内容は、入力のたびに端末に持ち、開き直したときに戻す（research.md の R11）。
 * 戻した書きかけが古い版から書き始めたものなら、開いたときの版の番号も書きかけの番号にする。
 * こうすると、その後に別の画面で保存されていれば、保存が止まる（research.md の R4）
 */

type Action = (state: NoteFormResult | null, formData: FormData) => Promise<NoteFormResult>;

type Props = {
  action: Action;
  initialValues: NoteFormValues;
  /** 編集する note。持たなければ作るフォーム */
  note?: {
    uid: string;
    /** 最新の版の番号 */
    latestRevision: number;
    /** 一度でも公開したか。公開した note の識別子は変えられない（FR-003） */
    slugLocked: boolean;
    /** この画面で保存した直後なら、保存した版の番号。書きかけを消す */
    savedRevision: number | null;
  };
};

const ERROR_MESSAGES: Record<NoteField, Partial<Record<NoteFieldError, string>>> = {
  slug: {
    missing: '識別子を入力してください',
    invalid: '識別子は英小文字・数字・ハイフンで、100 文字までにしてください',
    'slug-taken': 'この識別子はほかの note が使っています。削除した note の識別子も使えません',
    'slug-locked': '一度公開した note の識別子は変えられません',
  },
  title: { 'too-long': `題は ${NOTE_TITLE_MAX} 文字までにしてください` },
  description: {},
  body: { 'too-long': `本文は ${NOTE_BODY_MAX.toLocaleString('ja-JP')} 文字までにしてください` },
};

const RESULT_MESSAGES: Record<Exclude<NoteFormResult['status'], 'saved'>, string> = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
  conflict:
    'この note は、開いた後に別の画面で保存されていました。保存していません。入力した内容は、この画面とこの端末に残っています',
  deleted: 'この note は削除されています。保存していません。戻してから保存してください',
};

export const NoteForm = ({ action, initialValues, note }: Props) => {
  const [result, formAction, pending] = useActionState(action, null);
  const key = draftKey(note?.uid ?? null);
  const latestRevision = note?.latestRevision ?? 0;
  const [restored, setRestored] = useState<NoteDraft | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // 開いたときに、保存していない書きかけを戻す。保存した直後なら消す
  useEffect(() => {
    if (note?.savedRevision !== null && note?.savedRevision === latestRevision) {
      clearDraft(key);
      // 作った直後（版が 1 つ）は、作る画面の書きかけも消す
      if (latestRevision === 1) clearDraft(draftKey(null));
      // 保存の印を URL から外す。開き直したときに、その後の書きかけを消さないため
      window.history.replaceState(window.history.state, '', window.location.pathname);
      return;
    }
    const draft = readDraft(key);
    if (!draft) return;
    if (sameValues(draft.values, initialValues) && draft.baseRevision === latestRevision) {
      clearDraft(key);
      return;
    }
    // 端末に残った書きかけを、開いた後に一度だけ画面へ移す
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestored(draft);
  }, [key, latestRevision, note?.savedRevision, initialValues]);

  const values: NoteFormValues =
    result && 'values' in result
      ? { ...initialValues, ...result.values }
      : (restored?.values ?? initialValues);
  const baseRevision = restored?.baseRevision ?? latestRevision;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: NoteField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  const remember = () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const read = (name: string) => {
      const value = data.get(name);
      return typeof value === 'string' ? value : '';
    };
    writeDraft(key, {
      values: {
        slug: read('slug'),
        title: read('title'),
        description: read('description'),
        body: read('body'),
      },
      baseRevision,
    });
  };

  const discard = () => {
    clearDraft(key);
    setRestored(null);
  };

  /** 書きかけを、最新の版に重ねて続ける。最新の版を見比べて書き直した後に使う */
  const rebase = () => {
    if (!restored) return;
    const next = { ...restored, baseRevision: latestRevision };
    writeDraft(key, next);
    setRestored(next);
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={remember}
      className="flex flex-col gap-6"
      // 戻した書きかけと保存の結果で、入力の初めの値を描き直す
      key={`${restored ? `draft-${restored.baseRevision}` : 'saved'}-${result?.status ?? ''}`}
    >
      {note && (
        <>
          <input type="hidden" name={NOTE_UID_FIELD} value={note.uid} />
          <input type="hidden" name={OPENED_REVISION_FIELD} value={baseRevision} />
        </>
      )}

      {result && result.status !== 'saved' && (
        <div role="alert" className="flex flex-col gap-2 text-destructive">
          <p>{RESULT_MESSAGES[result.status]}</p>
          {result.status === 'conflict' && note && (
            <p>
              <a
                href={`/dash/notes/${note.uid}`}
                target="_blank"
                rel="noopener"
                className="underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                保存されている最新の版を別のタブで開く
              </a>
              。見比べて書き直した後、この画面を開き直し、「書きかけを最新の版に重ねて続ける」を押してから保存してください
            </p>
          )}
        </div>
      )}

      {restored && !result && (
        <div role="status" className="flex flex-col gap-2 rounded-md border border-border p-4">
          <p>保存していない書きかけの内容を、この端末から戻しました。</p>
          {restored.baseRevision < latestRevision && (
            <p>
              この書きかけは版 {restored.baseRevision} から書き始めたものです。その後に版{' '}
              {latestRevision}{' '}
              が保存されています。このまま保存すると止まります。最新の版と見比べて書き直してから、「書きかけを最新の版に重ねて続ける」を押してください
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {restored.baseRevision < latestRevision && (
              <button type="button" onClick={rebase} className={SECONDARY_BUTTON}>
                書きかけを最新の版に重ねて続ける
              </button>
            )}
            <button type="button" onClick={discard} className={SECONDARY_BUTTON}>
              書きかけを捨てる
            </button>
          </div>
        </div>
      )}

      <InputField
        name="slug"
        label="識別子"
        hint={
          note?.slugLocked
            ? '一度公開した note の識別子は変えられません'
            : 'URL（/notes/識別子）に出ます。英小文字・数字・ハイフンで、100 文字まで。初めて公開するまで変えられます'
        }
        defaultValue={values.slug}
        readOnly={note?.slugLocked}
        autoComplete="off"
        autoCapitalize="none"
        error={errorOf('slug')}
      />
      <InputField
        name="title"
        label="題"
        hint="下書きのうちは空でも保存できます。題が空の note は公開できません"
        defaultValue={values.title}
        autoComplete="off"
        error={errorOf('title')}
      />
      <TextareaField
        name="description"
        label="説明文"
        hint="空にできます。空なら、リンクが貼られたときのカードに本文の冒頭を使います"
        rows={2}
        defaultValue={values.description}
        error={errorOf('description')}
      />
      <TextareaField
        name="body"
        label="本文"
        hint="Markdown で書きます。画像は ![説明](media:ファイル名)、URL だけの段落はカードになります"
        rows={16}
        defaultValue={values.body}
        className="font-mono text-sm"
        error={errorOf('body')}
      />
      <div>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {note ? '保存する' : '作る'}
        </button>
      </div>
    </form>
  );
};

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const PRIMARY_BUTTON = `rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50 ${FOCUS}`;
const SECONDARY_BUTTON = `rounded-md border border-border px-3 py-1 ${FOCUS}`;
