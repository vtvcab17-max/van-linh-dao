// Ảnh minh họa công trình do flow AI sinh (4 nhóm × 3 cấp) và ảnh đảo. Dùng làm tranh minh họa trong giao diện,
// còn hình trên bản đồ vẫn là sprite art2 để giữ đồng bộ.
import type { BKey } from '../../../shared/economy';
import res1 from '../assets/ai/res1.jpg';
import res2 from '../assets/ai/res2.jpg';
import res3 from '../assets/ai/res3.jpg';
import eco1 from '../assets/ai/eco1.jpg';
import eco2 from '../assets/ai/eco2.jpg';
import eco3 from '../assets/ai/eco3.jpg';
import nav1 from '../assets/ai/nav1.jpg';
import nav2 from '../assets/ai/nav2.jpg';
import nav3 from '../assets/ai/nav3.jpg';
import def1 from '../assets/ai/def1.jpg';
import def2 from '../assets/ai/def2.jpg';
import def3 from '../assets/ai/def3.jpg';
import island from '../assets/ai/island.jpg';

export type AiGroup = 'res' | 'eco' | 'nav' | 'def';
const ART: Record<AiGroup, [string, string, string]> = {
  res: [res1, res2, res3],
  eco: [eco1, eco2, eco3],
  nav: [nav1, nav2, nav3],
  def: [def1, def2, def3],
};
export const AI_ISLAND = island;

/** Công trình nào có tranh nhóm nào (nông trại, chế biến, học viện chưa có tranh). */
export const AI_GROUP_OF: Partial<Record<BKey, AiGroup>> = {
  nhadan: 'res',
  den: 'res',
  khothoc: 'eco',
  cho: 'eco',
  xuongren: 'eco',
  tramthue: 'nav',
  benthuyen: 'nav',
  thapcanh: 'def',
  tuong: 'def',
  donbinh: 'def',
  xuongcg: 'def',
};
/** Tên nhóm trong bảng Xây dựng → nhóm tranh. */
export const AI_GROUP_OF_TAB: Record<string, AiGroup | undefined> = { 'Nhà cửa': 'res', 'Kinh tế': 'eco', 'Học thuật': 'nav', 'Thành trì': 'def' };

export const aiGroupArt = (g: AiGroup) => ART[g];
export const aiArt = (k: BKey, lv: number): string | undefined => {
  const g = AI_GROUP_OF[k];
  return g ? ART[g][Math.max(1, Math.min(3, lv)) - 1] : undefined;
};
