import { Metadata } from 'next';

type Params = { title: string; description?: string; keywords?: string[] };

export const createMetadata = ({ title, description, keywords = [] }: Params): Metadata => {
  const formattedTitle = `${title} | synsk.me`;
  return {
    title: formattedTitle,
    description,
    keywords: [
      'portfolio',
      'synsk',
      'ksyunnnn',
      '小橋俊介',
      'こばしゅん',
      'SYUNSUKE KOBASHI',
      'Nextjs',
      'React',
      'TypeScript',
    ].concat(keywords),

    openGraph: {
      type: 'website',
      title: formattedTitle,
      description: description,
    },

    twitter: {
      card: 'summary_large_image',
      title: formattedTitle,
      description: description,
      creator: '@ksyunnnn',
    },
  };
};
