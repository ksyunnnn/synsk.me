import { PlanetIcon as Planet } from '@phosphor-icons/react/dist/ssr/Planet';
import { siFacebook, siX } from 'simple-icons';

/**
 * オーナーの SNS へのリンク。別のタブで開く。アイコンは Simple Icons のもの。Simple Icons にない
 * LinkedIn は Phosphor Icons の Planet にする（design/foundations.pen の Icons）
 */
const SIMPLE_ICON_LINKS = [
  { href: 'https://twitter.com/ksyunnnn', label: 'Twitter', path: siX.path },
  { href: 'https://www.facebook.com/syunsuke.kobashi', label: 'Facebook', path: siFacebook.path },
];

const linkClassName = 'block size-space-md';

export const SnsLinks = ({ className }: { className?: string }) => (
  <ul className={`flex items-end gap-space-xs ${className ?? ''}`}>
    {SIMPLE_ICON_LINKS.map(({ href, label, path }) => (
      <li key={label}>
        <a
          href={href}
          aria-label={label}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-full fill-current">
            <path d={path} />
          </svg>
        </a>
      </li>
    ))}
    <li>
      <a
        href="https://www.linkedin.com/in/synsk"
        aria-label="LinkedIn"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        <Planet aria-hidden className="size-full" />
      </a>
    </li>
  </ul>
);
