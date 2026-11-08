/**
 * 空にできる入力の値を保存する値に読み替える。空白だけなら null。それ以外は入力のまま返し、
 * 前後の空白を落とさない。1 行の値（学部・秘匿化した組織名・URL）は呼ぶ側が `?.trim()` で落とし、
 * 複数行の値（本文・備考）は入力のまま残す
 */
export const emptyToNull = (value: string): string | null => (value.trim() === '' ? null : value);
