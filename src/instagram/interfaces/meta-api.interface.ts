export interface MetaMediaContainerResponse {
  id: string;
}

export interface MetaPublishResponse {
  id: string;
}

export interface MetaContainerStatusResponse {
  status_code?: string;
}

export interface PublishPostResult {
  success: boolean;
  postId?: string;
  imageUrl?: string;
  error?: string;
}
