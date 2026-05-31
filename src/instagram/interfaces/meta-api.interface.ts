export interface MetaMediaContainerResponse {
  id: string;
}

export interface MetaPublishResponse {
  id: string;
}

export interface MetaContainerStatusResponse {
  status_code?: string;
  id?: string;
}

export interface PublishPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}
