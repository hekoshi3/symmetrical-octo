export interface BackdendResIMG {
  count: number;
  next: undefined;
  previous: undefined;
  results: GalleryImage[];
}

export interface GalleryImage {
  id: number;
  author: Author;
  is_liked: boolean;
  image: string;
  generation_params: GenParams;
  is_published: boolean;
  likes_count: number;
  created_at: Date;
  linked_model: number;
  resources: undefined[];
}

export interface BackdendResMODEL {
  count: number;
  next: undefined;
  previous: undefined;
  results: ModelList[];
}

export interface ModelList {
  id: number;
  author: Author;
  is_liked: boolean;
  name: string;
  model_type: string;
  description: string;
  file: string;
  file_hash: string;
  downloads_count: number;
  likes_count: number;
  is_published: boolean;
  created_at: Date;
  featured_image: number;
  featured_image_url: string,
}

export interface Author {
  id: number;
  username: string;
  profile: {
    username: string;
    bio: string;
    avatar: string | null;
  };
  followers_count: number;
  is_following: boolean;
}

export interface UserProfile {
  username: string,
  avatar: string | null,
  stats: {
    total_downloads: number,
    total_likes: number,
    followers: number,
    models_count: number,
    images_count: number
  }
}

export interface GenParams {
  raw: string;
  seed: string;
  size: string;
  model: string;
  steps: string;
  width: number;
  height: number;
  prompt: string;
  sampler: string;
  version: string;
  cfg_scale: string;
  fp8_weight: string;
  model_hash: string;
  hires_steps: string;
  hires_upscale: string;
  schedule_type: string;
  hires_upscaler: string;
  negative_prompt: string;
  denoising_strength: string;
  cache_fp16_weight_for_lora: string;
}

export interface Comment {
  id: number;
  author: Author;
  text: string;
  created_at: string;
  image?: number;
  aimodel?: number;
}

export interface CommentList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Comment[];
}