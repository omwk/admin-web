export interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
  request_id?: string;
  trace_id: string;
}

export interface PageResult<T> {
  list: T[];
  page: number;
  page_size: number;
  total: number;
}
