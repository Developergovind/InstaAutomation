export interface ImgbbUploadData {
  url: string;
  display_url?: string;
  delete_url?: string;
}

export interface ImgbbUploadResponse {
  data?: ImgbbUploadData;
  success?: boolean;
  status?: number;
  error?: {
    message?: string;
    code?: number;
  };
}
