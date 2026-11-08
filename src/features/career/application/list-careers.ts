import type { CareerSummary } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';

/** オーナーの職歴の一覧 */
export const listCareers = (careers: CareerRepository): Promise<CareerSummary[]> => careers.list();
