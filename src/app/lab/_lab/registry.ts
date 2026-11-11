import { routes } from '@/shared/routes';
/// <reference types="vite/client" />
// デザインの実験の一覧。実験は lab/{name}/v{n}/ に置き、各バージョンのフォルダに meta.ts を置く。
// meta.ts は `export const meta: VersionMeta = { summary: '…' }` の形で、前のバージョンとの違いを一文で書く。
// lab/{name}/page.tsx は `<VersionList name="{name}" />` を返すだけのファイルにする。

export type VersionMeta = { summary: string };

export type LabVersion = { version: string; href: string; summary: string };

const metas = import.meta.glob<VersionMeta>('../*/v*/meta.ts', { eager: true, import: 'meta' });

const versionNumber = (version: string) => Number(version.slice(1));

const collect = () => {
  const experiments = new Map<string, LabVersion[]>();
  for (const [path, meta] of Object.entries(metas)) {
    const [, name, version] = path.split('/');
    const versions = experiments.get(name) ?? [];
    versions.push({ version, href: routes.labPage(name, version), summary: meta.summary });
    experiments.set(name, versions);
  }
  for (const versions of experiments.values()) {
    versions.sort((a, b) => versionNumber(a.version) - versionNumber(b.version));
  }
  return experiments;
};

export const getExperiments = () =>
  [...collect()]
    .map(([name, versions]) => ({ name, versions }))
    .sort((a, b) => a.name.localeCompare(b.name));

export const getVersions = (name: string) => collect().get(name) ?? [];
