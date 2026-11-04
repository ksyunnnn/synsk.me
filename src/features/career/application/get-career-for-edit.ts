import type { Career, CareerId } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';

/** 作り手が編集する職歴。無い id なら null */
export const getCareerForEdit = (careers: CareerRepository, id: CareerId): Promise<Career | null> =>
  careers.findForEdit(id);
