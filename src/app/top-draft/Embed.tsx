// kind が embed の行の埋め込み。組み立て方はサービスごとに違うので source で選ぶ。
// 組み立て方は PR #47 の検証（docs/scraps/external-api-verification.md）による
import { XPost } from './XPost';

const frameClass = 'w-full rounded-md border-0';

const lastSegment = (url: string) => new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';

const Unavailable = ({ source }: { source: string }) => (
  <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-muted-foreground p-4 text-center text-sm text-muted-foreground">
    {source} の埋め込み
    <br />
    （モックの URL が作り物のため表示できない）
  </div>
);

export const Embed = ({
  source,
  url,
  title,
  api,
}: {
  source: string;
  url: string;
  title: string;
  api: Record<string, unknown> | null;
}) => {
  switch (source) {
    case 'x_post':
      return <XPost url={url} />;
    case 'spotify_playlist':
      return (
        <iframe
          title={title}
          src={`https://open.spotify.com/embed/playlist/${lastSegment(url)}`}
          height={352}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className={frameClass}
        />
      );
    case 'codepen_sandbox': {
      const [user, , id] = new URL(url).pathname.split('/').filter(Boolean);
      return (
        <iframe
          title={title}
          src={`https://codepen.io/${user}/embed/${id}?default-tab=result`}
          height={300}
          loading="lazy"
          className={frameClass}
        />
      );
    }
    case 'codesandbox_sandbox':
      return (
        <iframe
          title={title}
          src={`https://codesandbox.io/embed/${lastSegment(url)}`}
          height={500}
          loading="lazy"
          sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
          className={frameClass}
        />
      );
    case 'speakerdeck_talk': {
      const src = typeof api?.html === 'string' ? api.html.match(/src="([^"]+)"/)?.[1] : undefined;
      if (!src) return <Unavailable source={source} />;
      return (
        <iframe
          title={title}
          src={src}
          loading="lazy"
          allowFullScreen
          className={`${frameClass} aspect-[710/399]`}
        />
      );
    }
    case 'youtube_video': {
      const host = new URL(url).hostname;
      if (host !== 'www.youtube.com' && host !== 'youtu.be') return <Unavailable source={source} />;
      const id = host === 'youtu.be' ? lastSegment(url) : new URL(url).searchParams.get('v');
      return (
        <iframe
          title={title}
          src={`https://www.youtube.com/embed/${id}`}
          loading="lazy"
          allowFullScreen
          className={`${frameClass} aspect-video`}
        />
      );
    }
    default:
      return <Unavailable source={source} />;
  }
};
