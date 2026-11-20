import { PROJECT_KINDS, PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';

/**
 * 実績の種類を 4 つから 1 つ選ぶ。値が少なく決まっているので、並べて一目で選べる形にする。
 * 操作はネイティブの radio が持つ。使い手は実績と写した実績の入力（元と写しで形をそろえる、
 * #366 の明文化）
 */
export const KindField = ({ value, error }: { value: string; error?: string }) => (
  <fieldset className="flex flex-col gap-1">
    <legend className="text-small font-medium">種類</legend>
    <div className="grid grid-cols-4 rounded-xl bg-muted p-0.5 text-small">
      {PROJECT_KINDS.map((kind) => (
        <label key={kind} className="relative">
          <input
            type="radio"
            name="kind"
            value={kind}
            defaultChecked={value === kind}
            className="peer sr-only"
          />
          <span className="block cursor-pointer rounded-[10px] py-1.5 text-center text-muted-foreground transition-colors peer-checked:bg-background peer-checked:font-medium peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-ring motion-reduce:transition-none">
            {PROJECT_KIND_LABELS[kind]}
          </span>
        </label>
      ))}
    </div>
    {error && <p className="text-sm text-destructive">{error}</p>}
  </fieldset>
);
