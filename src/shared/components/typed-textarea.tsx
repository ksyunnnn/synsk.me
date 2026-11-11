'use client';

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';

/**
 * JavaScript が動く前（hydration の前）に打った値を、動いた後も残す `<textarea>`。
 *
 * react-dom 19.3.1 の hydration は、初めの値を持つ `<textarea>` の値を初めの値に戻す
 * （`react-dom-client` の `initTextarea` が `element.value = textContent` を入れる）。そのままでは、
 * 動く前に打った値が消え、保存は初めの値を送る。`<input>` は hydration の間は値を書かれないので
 * 残る（`initInput`）。
 *
 * このモジュールは、フォームを hydration する前に読み込まれる。読み込んだ時点で初めの値と違う
 * 値と、それから動き始めるまでの入力を、要素ごとに持つ。動き始めたら、持った値を戻す。
 * 端末（localStorage）には書かない。書きかけを端末に残すのは note の入力だけで、
 * `src/shared/components/draft-retention.tsx` が持つ
 */

const MARK = 'data-keeps-typed';

/** 動く前に打った値。動き始めた要素からは消す */
const typedBeforeHydration = new WeakMap<HTMLTextAreaElement, string>();
/** 動き始めた要素。これより後の入力は、要素が自分で持つ */
const hydrated = new WeakSet<HTMLTextAreaElement>();

const capture = (element: HTMLTextAreaElement) => {
  if (hydrated.has(element)) return;
  // 打った後に初めの値へ戻したら、持った値を捨てる
  if (element.value !== element.defaultValue) typedBeforeHydration.set(element, element.value);
  else typedBeforeHydration.delete(element);
};

if (typeof document !== 'undefined') {
  for (const element of Array.from(
    document.querySelectorAll<HTMLTextAreaElement>(`textarea[${MARK}]`),
  ))
    capture(element);
  document.addEventListener(
    'input',
    (event) => {
      if (event.target instanceof HTMLTextAreaElement && event.target.hasAttribute(MARK))
        capture(event.target);
    },
    true,
  );
}

export const TypedTextarea = (props: ComponentPropsWithoutRef<'textarea'>) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    hydrated.add(element);
    const typed = typedBeforeHydration.get(element);
    typedBeforeHydration.delete(element);
    if (typed !== undefined) element.value = typed;
  }, []);
  return <textarea {...props} ref={ref} {...{ [MARK]: '' }} />;
};
