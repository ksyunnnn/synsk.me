import type { TimelineSource } from '../types';
import { codepenSource } from './codepen';
import { codesandboxSource } from './codesandbox';
import { connpassSource } from './connpass';
import { devtoSource } from './devto';
import { githubSource } from './github';
import { mediumSource } from './medium';
import { qiitaSource } from './qiita';
import { speakerdeckSource } from './speakerdeck';
import { spotifySource } from './spotify';
import { xSource } from './x';
import { zennSource } from './zenn';

export const TIMELINE_SOURCES: TimelineSource[] = [
  zennSource,
  qiitaSource,
  devtoSource,
  mediumSource,
  githubSource,
  speakerdeckSource,
  codesandboxSource,
  codepenSource,
  connpassSource,
  spotifySource,
  xSource,
];
