'use client';

import { Combobox } from '@base-ui/react/combobox';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 選んだ値だけをトークンで出し、文字を打つと候補が出る欄（HIG Token fields、Entering data の
 * 「When possible, offer choices instead of requiring text entry」）。操作とキーボードは Base UI の
 * Combobox（`multiple`）に任せる（https://base-ui.com/react/components/combobox）。
 *
 * 送る値は、Combobox の `name` を使わず、隠れた入力をこの部品が描く。サーバーが描いた HTML にも
 * 初めの値が入り、送る値の形（値ごとに 1 つ・改行でつなぐ）を呼び手が選べるようにするため。
 * 隠れた入力の値を書き換えても input のイベントは出ないので、選んだ値が変わったら input のイベントを
 * 出し、フォームの直しかけの読み取り（`useDraft` の `bind`）に知らせる。
 *
 * 使い手は実績と写した実績の「使ったスキル」（元と写しで形をそろえる、#366 の明文化）
 */

type Option = { value: string; label: string };
/** 候補にない名前を足すための、打った文字そのものの候補 */
type Item = Option & { created?: boolean };

export const TokenField = ({
  name,
  label,
  hint,
  error,
  options,
  defaultValue,
  serialize,
  allowCustom = false,
  empty,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** 候補 */
  options: Option[];
  /** 初めに選んでいる値 */
  defaultValue: string[];
  /** `each` は値ごとに同じ名前の入力を 1 つ、`lines` は改行でつないだ 1 つの入力で送る */
  serialize: 'each' | 'lines';
  /** 候補にない値も足せるか。足した値は、打った文字がそのまま値と名前になる */
  allowCustom?: boolean;
  /** 打った文字に合う候補が無いときの文 */
  empty: string;
}) => {
  const id = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLSpanElement>(null);
  const [selected, setSelected] = useState<Option[]>(() =>
    defaultValue.map(
      (value) => options.find((option) => option.value === value) ?? { value, label: value },
    ),
  );
  const [query, setQuery] = useState('');

  const changed = useRef(false);
  useEffect(() => {
    if (!changed.current) return;
    changed.current = false;
    hiddenRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [selected]);

  const typed = query.trim();
  const canCreate =
    allowCustom &&
    typed !== '' &&
    !options.some((option) => option.label === typed) &&
    !selected.some((option) => option.value === typed);
  const items: Item[] = canCreate
    ? [...options, { value: typed, label: typed, created: true }]
    : options;

  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-input`} className="text-small font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <Combobox.Root
        items={items}
        multiple
        value={selected}
        onValueChange={(next: Item[]) => {
          changed.current = true;
          setSelected(next.map(({ value, label }) => ({ value, label })));
          setQuery('');
        }}
        inputValue={query}
        onInputValueChange={setQuery}
        isItemEqualToValue={(item: Option, value: Option) => item.value === value.value}
        itemToStringLabel={(item: Option) => item.label}
        autoHighlight
      >
        <Combobox.Chips
          ref={anchorRef}
          className={cn(
            'flex flex-wrap items-center gap-1.5 rounded-xl border border-transparent bg-muted px-2 py-1.5 transition-colors focus-within:border-input focus-within:bg-background motion-reduce:transition-none',
            error && 'border-destructive',
          )}
        >
          <Combobox.Value>
            {(value: Option[]) => (
              <>
                {value.map((item) => (
                  <Combobox.Chip
                    key={item.value}
                    aria-label={item.label}
                    className="flex items-center gap-1 rounded-full bg-background py-0.5 pr-1 pl-3 text-small shadow-sm outline-none data-[highlighted]:outline-2 data-[highlighted]:outline-ring"
                  >
                    {item.label}
                    <Combobox.ChipRemove
                      aria-label={`${item.label}を外す`}
                      className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5"
                    >
                      <span aria-hidden>×</span>
                    </Combobox.ChipRemove>
                  </Combobox.Chip>
                ))}
                <Combobox.Input
                  id={`${id}-input`}
                  aria-describedby={describedBy}
                  aria-invalid={error ? true : undefined}
                  placeholder={value.length === 0 ? '名前を打つと候補が出ます' : undefined}
                  className="min-w-24 flex-1 bg-transparent px-1 py-0.5 outline-none"
                />
              </>
            )}
          </Combobox.Value>
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner anchor={anchorRef} sideOffset={6} align="start" className="z-50">
            {/* 半分の高さのガラスのシートの上にも出るので、ガラスにせず塗りにする（glass on glass を避ける） */}
            <Combobox.Popup className="max-h-[min(60dvh,var(--available-height))] w-[var(--anchor-width)] overflow-y-auto rounded-2xl border border-border bg-background p-1.5 text-small outline-none">
              <Combobox.Empty className="px-3 py-1.5 text-muted-foreground empty:hidden">
                {empty}
              </Combobox.Empty>
              <Combobox.List>
                {(item: Item) => (
                  <Combobox.Item
                    key={item.created ? `created:${item.value}` : item.value}
                    value={item}
                    className="flex cursor-default items-center gap-2 rounded-xl px-3 py-1.5 outline-none data-[highlighted]:bg-tint data-[highlighted]:text-tint-foreground"
                  >
                    <span aria-hidden className="w-3">
                      <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                    </span>
                    {item.created ? `「${item.label}」を足す` : item.label}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {/* 送る値。サーバーが描いた HTML にも入り、JavaScript が動く前に送っても初めの値が届く */}
      <span ref={hiddenRef} hidden>
        {serialize === 'each' ? (
          selected.map((option) => (
            <input key={option.value} type="hidden" name={name} value={option.value} />
          ))
        ) : (
          <input type="hidden" name={name} value={selected.map((o) => o.value).join('\n')} />
        )}
      </span>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
