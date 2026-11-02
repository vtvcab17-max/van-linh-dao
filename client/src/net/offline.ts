import { localId, NetBase } from './base';

/** Chơi một mình: lưu trên máy, Hải Khu có các đảo máy. */
export class OfflineNet extends NetBase {
  mode = 'offline' as const;
  label = 'Chơi trên máy này (có đảo máy)';
  async init() {
    this.meId = localId();
    this.onlineList = [{ id: this.meId, act: 'đang chơi' }];
  }
}
