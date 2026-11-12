import 'server-only';

/**
 * 待ち時間を超えたら、中止の合図を出し、`onTimeout` が返す誤りで投げる。`run` が中止の合図を
 * 見なくても待ち続けない。使い手は activity の取得元の取得と、note の URL カードの取得
 */
export const withTimeout = async <T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
  onTimeout: () => Error,
): Promise<T> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(onTimeout());
    }, timeoutMs);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
};
