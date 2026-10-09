'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  NOTE_ID_FIELD,
  type NoteContentErrors,
  type NoteFormResult,
  type NoteFormState,
  type NoteId,
  type NoteStatus,
} from '@/features/note/domain/note';

/**
 * note を作る・編集するフォーム。
 *
 * Server Action は props で受け取る。このファイルは `server/` を読み込まない
 * （ADR-0026 の依存の向き 3）。`useActionState` に渡した Server Action は、
 * JavaScript なしでもフォームの送信で動き、入力した値と結果を返す。
 *
 * 入力の規則はサーバで確かめ、誤りを文言で返す。`required` や `maxLength` を付けない。
 * ブラウザが送信を止めると、どの項目の何が合わないかを同じ形で伝えられないため。
 */

type NoteFormAction = (state: NoteFormState, formData: FormData) => Promise<NoteFormState>;

type Props = {
  action: NoteFormAction;
  initialState: NoteFormState;
  /**
   * 編集する note。持たなければ作るフォームで、「作る」のボタンを置く。持てば編集の
   * フォームで、「保存する」と「公開する」のボタンを置き、押したボタンを `intent` で送る
   */
  note?: { id: NoteId; status: NoteStatus };
};

const ERROR_MESSAGES: {
  [Field in keyof NoteContentErrors]-?: Record<NonNullable<NoteContentErrors[Field]>, string>;
} = {
  slug: {
    missing: 'slug を入力してください',
    invalid: 'slug は小文字の英字・数字・ハイフンで、100文字までにしてください',
  },
  title: {
    missing: '公開するには題を入力してください',
    'too-long': '題は200文字までにしてください',
  },
  body: {
    'too-long': '本文は100,000文字までにしてください',
  },
};

const RESULT_MESSAGES: Record<NoteFormResult, string> = {
  saved: '保存しました',
  published: '公開しました',
  'slug-taken': 'この slug は他の note が使っています',
  'slug-fixed': '公開した note の slug は変えられません',
  'not-found': 'この note は存在しません',
  'save-failed': '保存に失敗しました。もう一度試してください',
  'publish-failed': '公開に失敗しました。もう一度試してください',
  forbidden: '作り手であることを確かめられませんでした。ログインし直してから入力し直してください',
};

/** 操作がうまくいったことを伝える結果。ほかは誤りや失敗として伝える */
const SUCCEEDED: ReadonlySet<NoteFormResult> = new Set(['saved', 'published']);

export const NoteForm = ({ action, initialState, note }: Props) => {
  const [{ values, errors, result }, formAction] = useActionState(action, initialState);
  const published = note?.status === 'published';
  const slugError = errors.slug && ERROR_MESSAGES.slug[errors.slug];
  // 公開した note の slug を変えられないことを、入力の説明として読み上げにも伝える
  const slugDescription =
    [slugError && 'note-slug-error', published && 'note-slug-fixed'].filter(Boolean).join(' ') ||
    undefined;
  const titleError = errors.title && ERROR_MESSAGES.title[errors.title];
  const bodyError = errors.body && ERROR_MESSAGES.body[errors.body];

  return (
    <form action={formAction}>
      {note && <input type="hidden" name={NOTE_ID_FIELD} value={note.id} />}

      {result !== null && SUCCEEDED.has(result) && (
        <p role="status">
          {RESULT_MESSAGES[result]}
          {result === 'published' && (
            <>
              {' '}
              <Link href={`/notes/${values.slug}`}>公開した note を開く</Link>
            </>
          )}
        </p>
      )}
      {result !== null && !SUCCEEDED.has(result) && <p role="alert">{RESULT_MESSAGES[result]}</p>}

      <div>
        <label htmlFor="note-slug">slug</label>
        <input
          id="note-slug"
          name="slug"
          defaultValue={values.slug}
          readOnly={published}
          autoComplete="off"
          aria-invalid={slugError ? true : undefined}
          aria-describedby={slugDescription}
        />
        {published && <p id="note-slug-fixed">公開した note の slug は変えられません</p>}
        {slugError && <p id="note-slug-error">{slugError}</p>}
      </div>

      <div>
        <label htmlFor="note-title">題</label>
        <input
          id="note-title"
          name="title"
          defaultValue={values.title}
          autoComplete="off"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? 'note-title-error' : undefined}
        />
        {titleError && <p id="note-title-error">{titleError}</p>}
      </div>

      <div>
        <label htmlFor="note-body">本文</label>
        <textarea
          id="note-body"
          name="body"
          defaultValue={values.body}
          aria-invalid={bodyError ? true : undefined}
          aria-describedby={bodyError ? 'note-body-error' : undefined}
        />
        {bodyError && <p id="note-body-error">{bodyError}</p>}
      </div>

      {note ? (
        <>
          {/* 入力の中で Enter を押したときに送られる、先頭のボタンを「保存する」にする。
              公開は訪問者に見える操作のため、押したことが明らかなときだけ行う */}
          <button type="submit" name="intent" value="save">
            保存する
          </button>
          <button type="submit" name="intent" value="publish">
            {published ? '公開し直す' : '公開する'}
          </button>
        </>
      ) : (
        <button type="submit">作る</button>
      )}
    </form>
  );
};
