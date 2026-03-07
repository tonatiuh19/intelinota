/**
 * Shared API types — used by both client and server
 */

// ── Entities ────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  slug: string;
}

export interface Author {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
}

export interface Article {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  category_id: number;
  category_name: string;
  category_slug: string;
  subcategory_id: number | null;
  subcategory_name: string | null;
  subcategory_slug: string | null;
  author_id: number;
  author_name: string;
  author_slug: string;
  image_url: string | null;
  read_time_minutes: number;
  featured: boolean;
  trending: boolean;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  view_count: number;
}

// ── Content Blocks ───────────────────────────────────────────
// Each article can have an ordered list of rich-content blocks.
// The `data` field is typed per block type.

export type ContentBlockType =
  | "html"
  | "image"
  | "youtube"
  | "twitter"
  | "instagram"
  | "quote"
  | "divider";

export interface ContentBlockHtmlData {
  html: string;
}

export interface ContentBlockImageData {
  url: string;
  caption?: string;
  alt?: string;
  credit?: string;
}

export interface ContentBlockYouTubeData {
  video_id: string;
  caption?: string;
}

export interface ContentBlockTwitterData {
  tweet_url: string;
  tweet_id: string;
}

export interface ContentBlockInstagramData {
  post_url: string;
}

export interface ContentBlockQuoteData {
  text: string;
  attribution?: string;
}

export type ContentBlockData =
  | ContentBlockHtmlData
  | ContentBlockImageData
  | ContentBlockYouTubeData
  | ContentBlockTwitterData
  | ContentBlockInstagramData
  | ContentBlockQuoteData
  | Record<string, never>; // divider

export interface ContentBlock {
  id: number;
  article_id: number;
  position: number;
  type: ContentBlockType;
  data: ContentBlockData;
}

// ── Response wrappers ────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Endpoint-specific types ──────────────────────────────────

export type ArticlesResponse = PaginatedResponse<Article>;
export type ArticleResponse = ApiSuccess<Article>;
export type ArticleBlocksResponse = ApiSuccess<ContentBlock[]>;
export type CategoriesResponse = ApiSuccess<Category[]>;
export type AuthorsResponse = ApiSuccess<Author[]>;
export type AuthorResponse = ApiSuccess<Author & { articles: Article[] }>;
export type HealthResponse = ApiSuccess<{
  message: string;
  timestamp: string;
  database: "connected" | "not configured" | "error";
}>;

// ── Home page types ──────────────────────────────────────────

export interface HomeMeta {
  title: string;
  description: string;
  keywords: string;
  og_title: string;
  og_description: string;
  og_image: string;
  canonical_url: string;
}

export interface HomeData {
  featured: Article[];
  trending: Article[];
  articles: Article[];
  categories: Category[];
  meta: HomeMeta;
}

export type HomeResponse = ApiSuccess<HomeData>;
