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

export type FilePurpose = 'attachment' | 'export' | 'shop' | 'snapshot';

export interface LibraryFile {
  created_at: string;
  id: number;
  mime: string;
  original_name: string;
  purpose: FilePurpose;
  sha256: string;
  size_bytes: number;
}
