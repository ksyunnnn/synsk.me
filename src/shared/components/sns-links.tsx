import type { CSSProperties } from 'react';
import { PlanetIcon as Planet } from '@phosphor-icons/react/dist/ssr/Planet';
import { siFacebook, siX } from 'simple-icons';
import { cn } from '@/lib/utils';

/**
 * オーナーの SNS へのリンク。別のタブで開く。アイコンは Simple Icons のもの。Simple Icons にない
 * LinkedIn は Phosphor Icons の Planet にする（design/foundations.pen の Icons）。アイコンの
 * 大きさは `iconSize`、間は `gap` で渡す
 */
const SIMPLE_ICON_LINKS = [
  { href: 'https://twitter.com/ksyunnnn', label: 'Twitter', path: siX.path },
  { href: 'https://www.facebook.com/syunsuke.kobashi', label: 'Facebook', path: siFacebook.path },
];

export const SnsLinks = ({
  className,
  iconSize,
  gap,
}: {
  className?: string;
  iconSize: string;
  gap: string;
}) => {
  const linkStyle: CSSProperties = { width: iconSize, height: iconSize };
  return (
    <ul className={cn('flex items-end', className)} style={{ gap }}>
      {SIMPLE_ICON_LINKS.map(({ href, label, path }) => (
        <li key={label}>
          <a
            href={href}
            aria-label={label}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            style={linkStyle}
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
          className="block"
          style={linkStyle}
        >
          <Planet aria-hidden className="size-full" />
        </a>
      </li>
    </ul>
  );
};
