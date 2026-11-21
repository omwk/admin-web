export interface StorageInput {
  access_key: string;
  bucket: string;
  enabled: boolean;
  endpoint: string;
  is_default: boolean;
  name: string;
  path_style: boolean;
  port: number;
  public_base_url: string;
  region: string;
  secret_key: string;
  use_ssl: boolean;
}

export interface StorageProvider extends StorageInput {
  created_at: string;
  id: number;
  updated_at: string;
}

export type FileCategory =
  | 'archive'
  | 'document'
  | 'image'
  | 'other'
  | 'sheet'
  | 'text';

export interface FileUsage {
  file_count: number;
  quota_bytes: number;
  used_bytes: number;
}

export interface LibraryFile {
  category: FileCategory;
  created_at: string;
  id: number;
  mime: string;
  original_name: string;
  sha256: string;
  size_bytes: number;
  thumb_url?: null | string;
  uploaded_by?: null | number;
  uploaded_by_name?: string;
}
