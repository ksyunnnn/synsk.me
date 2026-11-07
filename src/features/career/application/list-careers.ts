import type { CareerSummary } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';

/** 作り手の職歴の一覧 */
export const listCareers = (careers: CareerRepository): Promise<CareerSummary[]> => careers.list();
