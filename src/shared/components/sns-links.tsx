import { siFacebook, siX } from 'simple-icons';

/**
 * オーナーの SNS へのリンク。アイコンは simple-icons のもの。simple-icons は LinkedIn の
 * アイコンを持たないため、LinkedIn は名前の文字で出す
 */
const ICON_LINKS = [
  { href: 'https://twitter.com/ksyunnnn', label: 'Twitter', icon: siX },
  { href: 'https://www.facebook.com/syunsuke.kobashi', label: 'Facebook', icon: siFacebook },
];

export const SnsLinks = ({ className }: { className: string }) => (
  <ul className={`flex items-end gap-3 ${className}`}>
    {ICON_LINKS.map(({ href, label, icon }) => (
      <li key={label}>
        <a href={href} aria-label={label} rel="noopener noreferrer" className="block">
          <svg aria-hidden viewBox="0 0 24 24" width={40} height={40} fill="#242424">
            <path d={icon.path} />
          </svg>
        </a>
      </li>
    ))}
    <li>
      <a
        href="https://www.linkedin.com/in/synsk"
        rel="noopener noreferrer"
        className="block text-[16px] leading-[40px] underline"
      >
        LinkedIn
      </a>
    </li>
  </ul>
);
