import type {
  ActivityId,
  ExternalActivity,
  FetchResult,
} from '@/features/activity/domain/activity';
import type { ActivityRepository } from '@/features/activity/domain/activity-repository';

/** 管理画面の一覧と取得の結果（contracts/dash.md、research.md の R13） */
export const listActivities = async (
  activities: ActivityRepository,
): Promise<{ activities: ExternalActivity[]; fetchResults: FetchResult[] }> => {
  const [rows, fetchResults] = await Promise.all([
    activities.list(),
    activities.listFetchResults(),
  ]);
  return { activities: rows, fetchResults };
};

/** オーナーが開く外部の activity。無い id なら null */
export const getActivityForEdit = (
  activities: ActivityRepository,
  id: ActivityId,
): Promise<ExternalActivity | null> => activities.findForEdit(id);
