/** 运单对应的包裹信息（来自「澳德回国」表格，按运单号关联） */
export interface ParcelInfo {
  content?: string;
  address?: string;
  expressCode?: string;
  status?: string;
  /** 预计到达时间（表格 ETA 列，形如 11.14） */
  eta?: string;
}

/** 运单号 -> 包裹信息 */
export type ParcelMap = Record<string, ParcelInfo>;

export interface TrackingHistoryItem {
  toStatus: string;
  createDate: string;
}

export interface TrackingResult {
  data: {
    hisList: TrackingHistoryItem[];
    wbInfo: {
      expressCode: string;
    };
  };
  msg: string;
  result: boolean;
}
