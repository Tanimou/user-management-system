export interface PaginationInfo {
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface SortInfo {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterInfo {
  search?: string;
  role?: string;
  status?: 'all' | 'active' | 'inactive';
  [key: string]: any;
}

export interface TableColumn {
  key: string;
  title: string;
  sortable?: boolean;
  width?: number;
  render?: (row: any, index: number) => any;
}

export interface UserListParams {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  role?: string;
  active?: boolean;
}

export interface UserListResponse {
  data: import('./auth').User[];
  pagination: PaginationInfo;
}