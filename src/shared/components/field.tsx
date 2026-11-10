import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * ネイティブの入力の要素に、ラベル・項目ごとの誤りの表示・フォーカスの見た目をかぶせる
 * （design/guidelines.md の Inputs）。操作はブラウザのネイティブの要素が持ち、ここは
 * 見た目と、ラベル・誤りと要素のつながりだけを持つ。値はトークンの名前で使う。
 *
 * 使い手は 001 の職歴・実績・学歴・スキル・組織の入力（specs/001-career-and-project/research.md の R11）。
 */

/** キーボードで操作しているときに、フォーカスの位置を目で確かめられる見た目（WCAG 2.2 SC 2.4.7） */
const FOCUS_VISIBLE =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const CONTROL =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-foreground aria-invalid:border-destructive';

type ControlProps = {
  /** 項目の名前。フォームの値の名前と、要素の id に使う */
  name: string;
  label: ReactNode;
  /** 入力の補足。ラベルの下に出す */
  hint?: ReactNode;
  /** 項目ごとの誤り。あれば要素を `aria-invalid` にし、読み上げでつなぐ */
  error?: ReactNode;
};

/**
 * 要素の id と、補足と誤りの id。ラベルと `aria-describedby` でつなぐ。id は `useId` で作り、
 * 同じ名前の項目を持つ別の画面が隠れて残っていても重ならないようにする。画面を移った後も、
 * 前の画面が隠れて DOM に残ることがある（2026-11-04 に、学歴の登録の画面から編集の画面へ
 * 移った後の E2E で確かめた）
 */
const useFieldIds = (name: string, { hint, error }: Pick<ControlProps, 'hint' | 'error'>) => {
  const base = `${useId()}-${name}`;
  const ids = { control: `${base}`, hint: `${base}-hint`, error: `${base}-error` };
  const list = [hint ? ids.hint : null, error ? ids.error : null].filter(Boolean);
  return { ...ids, describedBy: list.length > 0 ? list.join(' ') : undefined };
};

const FieldFrame = ({
  ids,
  label,
  hint,
  error,
  children,
}: Omit<ControlProps, 'name'> & { ids: ReturnType<typeof useFieldIds>; children: ReactNode }) => {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={ids.control} className="font-bold">
        {label}
      </label>
      {hint && (
        <p id={ids.hint} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={ids.error} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

type InputFieldProps = ControlProps & Omit<ComponentPropsWithoutRef<'input'>, 'name' | 'id'>;

export const InputField = ({ name, label, hint, error, className, ...props }: InputFieldProps) => {
  const ids = useFieldIds(name, { hint, error });
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error}>
      <input
        {...props}
        id={ids.control}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(CONTROL, FOCUS_VISIBLE, className)}
      />
    </FieldFrame>
  );
};

type SuggestingInputFieldProps = Omit<InputFieldProps, 'list'> & {
  /** 選択肢。入力の欄に出し、選ばずに自由に書くこともできる */
  options: readonly string[];
};

/**
 * 選択肢を出す文字の入力。ネイティブの `<datalist>` を使い、選択肢の表示とキーボードでの選び方は
 * ブラウザが持つ（specs/001-career-and-project/plan.md の U3 の決定。headless のライブラリを
 * 足さない）。使い手は職歴・実績の組織名（FR-002）
 */
export const SuggestingInputField = ({ options, ...props }: SuggestingInputFieldProps) => {
  const listId = `${useId()}-options`;
  return (
    <>
      <InputField {...props} list={listId} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
};

type TextareaFieldProps = ControlProps & Omit<ComponentPropsWithoutRef<'textarea'>, 'name' | 'id'>;

export const TextareaField = ({
  name,
  label,
  hint,
  error,
  className,
  ...props
}: TextareaFieldProps) => {
  const ids = useFieldIds(name, { hint, error });
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error}>
      <textarea
        {...props}
        id={ids.control}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(CONTROL, FOCUS_VISIBLE, className)}
      />
    </FieldFrame>
  );
};

type SelectFieldProps = ControlProps & Omit<ComponentPropsWithoutRef<'select'>, 'name' | 'id'>;

export const SelectField = ({
  name,
  label,
  hint,
  error,
  className,
  children,
  ...props
}: SelectFieldProps) => {
  const ids = useFieldIds(name, { hint, error });
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error}>
      <select
        {...props}
        id={ids.control}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(CONTROL, FOCUS_VISIBLE, className)}
      >
        {children}
      </select>
    </FieldFrame>
  );
};

type CheckboxFieldProps = ControlProps &
  Omit<ComponentPropsWithoutRef<'input'>, 'name' | 'id' | 'type'>;

/** チェックボックスは、要素をラベルの前に置く */
export const CheckboxField = ({
  name,
  label,
  hint,
  error,
  className,
  ...props
}: CheckboxFieldProps) => {
  const ids = useFieldIds(name, { hint, error });
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          {...props}
          type="checkbox"
          id={ids.control}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn('size-4 accent-primary', FOCUS_VISIBLE, className)}
        />
        <label htmlFor={ids.control}>{label}</label>
      </div>
      {hint && (
        <p id={ids.hint} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={ids.error} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
