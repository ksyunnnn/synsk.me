'use client';

import type { ComponentProps } from 'react';
import { OperationForm } from '@/shared/components/operation-form';
import { NOTE_COMMON_MESSAGES } from './note-messages';

/**
 * note の状態を変える操作のフォーム（公開・下書きに戻す・削除・戻す・過去の版に戻す・代表画像・
 * 転載先・参照先の情報の取り直し）。止めた理由の文言のうち、note の操作に共通するものを足す
 */
export const NoteActionForm = (
  props: Omit<ComponentProps<typeof OperationForm>, 'commonMessages'>,
) => <OperationForm {...props} commonMessages={NOTE_COMMON_MESSAGES} />;
