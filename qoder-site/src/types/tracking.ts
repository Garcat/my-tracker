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
