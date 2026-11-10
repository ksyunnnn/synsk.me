'use client';

import { useActionState } from 'react';
import {
  NOTE_UID_FIELD,
  SYNDICATION_URL_FIELD,
  type SyndicationFieldError,
  type SyndicationFormResult,
} from '@/features/note/domain/note';
import { InputField } from '@/shared/components/field';
import { SubmitButton } from '@/shared/components/submit-button';

/**
 * note の転載先の URL の一覧と、足す・外すフォーム（FR-031・FR-032、specs/003-note/contracts/dash.md）。
 * 外すフォームは主キーでなく URL を送る（research.md の R14）。転載先は訪問者に出さない（plan.md の U11）
 */

type AddAction = (
  state: SyndicationFormResult | null,
  formData: FormData,
) => Promise<SyndicationFormResult>;

type RemoveAction = (
  state: { status: 'forbidden' } | null,
  formData: FormData,
) => Promise<{ status: 'forbidden' }>;

type Props = {
  noteUid: string;
  urls: string[];
  addAction: AddAction;
  removeAction: RemoveAction;
};

const ERROR_MESSAGES: Record<SyndicationFieldError, string> = {
  missing: '転載先の URL を入力してください',
  invalid: '転載先の URL は http か https で始まる URL にしてください',
  taken: 'この URL は、この note かほかの note に記録済みです',
};

const FORBIDDEN = 'オーナーであることを確かめられませんでした。ログインし直してください';

const BUTTON =
  'rounded-md border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const RemoveForm = ({
  noteUid,
  url,
  action,
}: {
  noteUid: string;
  url: string;
  action: RemoveAction;
}) => {
  const [result, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
      <input type="hidden" name={SYNDICATION_URL_FIELD} value={url} />
      <span className="break-all">{url}</span>
      <SubmitButton className={BUTTON} aria-label={`${url} を外す`}>
        外す
      </SubmitButton>
      {result?.status === 'forbidden' && (
        <p role="alert" className="text-destructive">
          {FORBIDDEN}
        </p>
      )}
    </form>
  );
};

export const NoteSyndicationForm = ({ noteUid, urls, addAction, removeAction }: Props) => {
  const [result, formAction] = useActionState(addAction, null);
  const error = result?.status === 'invalid' ? result.errors[SYNDICATION_URL_FIELD] : undefined;
  const value = result && 'values' in result ? (result.values[SYNDICATION_URL_FIELD] ?? '') : '';

  return (
    <section aria-labelledby="note-syndication-heading" className="flex flex-col gap-3">
      <h2 id="note-syndication-heading" className="text-lg font-bold">
        転載先
      </h2>
      {urls.length === 0 ? (
        <p>記録した転載先はありません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {urls.map((url) => (
            <li key={url}>
              <RemoveForm noteUid={noteUid} url={url} action={removeAction} />
            </li>
          ))}
        </ul>
      )}
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name={NOTE_UID_FIELD} value={noteUid} />
        {result?.status === 'forbidden' && (
          <p role="alert" className="text-destructive">
            {FORBIDDEN}
          </p>
        )}
        <InputField
          key={value}
          inputMode="url"
          name={SYNDICATION_URL_FIELD}
          label="転載先の URL"
          defaultValue={value}
          autoComplete="off"
          error={error ? ERROR_MESSAGES[error] : undefined}
        />
        <div>
          <SubmitButton className={BUTTON}>転載先を記録する</SubmitButton>
        </div>
      </form>
    </section>
  );
};
