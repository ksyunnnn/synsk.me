'use client';

import { Switch } from '@base-ui/react/switch';
import { useId, type ReactNode } from 'react';

/**
 * オンとオフを切り替える 1 行。強調したい設定は Switch にする（HIG Toggles の macOS の項）。
 * 操作とキーボードは Base UI の Switch が持ち、ここは見た目だけを持つ。オンとオフで送る値を
 * それぞれ決め、受け取る側の値の形を変えない
 */
export const SwitchField = ({
  name,
  label,
  hint,
  defaultChecked,
  checkedValue,
  uncheckedValue,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  defaultChecked: boolean;
  checkedValue: string;
  uncheckedValue: string;
}) => {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-small text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <Switch.Root
        id={id}
        name={name}
        value={checkedValue}
        uncheckedValue={uncheckedValue}
        defaultChecked={defaultChecked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="relative mt-0.5 inline-flex h-7 w-12 shrink-0 rounded-full bg-foreground/15 p-0.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[checked]:bg-tint motion-reduce:transition-none"
      >
        <Switch.Thumb className="size-6 rounded-full bg-background shadow-sm transition-transform duration-200 data-[checked]:translate-x-5 motion-reduce:transition-none" />
      </Switch.Root>
    </div>
  );
};
