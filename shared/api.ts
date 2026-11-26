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

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
}

export interface Author {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
  social_links?: SocialLinks | null;
  /** Authors list only: published stories */
  article_count?: number;
  /** Authors list only: most recent publish date */
  latest_published_at?: string | null;
}

export type ArticleStatus =
  | "draft"
  | "in_review"
  | "published"
  | "archived"
  | "scheduled";

export interface Tag {
  id: number;
  name: string;
  slug: string;
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
  status: ArticleStatus;
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
  app_version: string | null;
}

export interface HomeData {
  featured: Article[];
  trending: Article[];
  articles: Article[];
  /** Most viewed articles in the last 30 days */
  mostRead: Article[];
  categories: Category[];
  meta: HomeMeta;
}

export type HomeResponse = ApiSuccess<HomeData>;

// ── Admin types ──────────────────────────────────────────────

export type AdminRole = "admin" | "author";

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  role: AdminRole;
  author_id: number | null;
  avatar_url: string | null;
  bio?: string | null;
  twitter_handle?: string | null;
  social_links?: SocialLinks | null;
}

// Extended author with linked user info (for admin management page)
export interface AdminAuthor extends Author {
  email: string | null;
  user_id: number | null;
  user_role: AdminRole | null;
}

// Article with full fields including draft/archived (admin sees all statuses)
export interface AdminArticle extends Article {
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_articles: number;
  published_articles: number;
  draft_articles: number;
  archived_articles: number;
  total_views: number;
  total_authors: number;
  total_visitors_30d: number;
  top_articles: Array<{
    id: number;
    slug: string;
    title: string;
    view_count: number;
    category_name: string;
  }>;
  views_by_day: Array<{ date: string; count: number }>;
}

// ── Admin request payloads ───────────────────────────────────

export interface RequestCodePayload {
  email: string;
}

export interface VerifyCodePayload {
  email: string;
  code: string;
}

export interface UpsertArticlePayload {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  category_id: number;
  subcategory_id: number | null;
  author_id: number;
  image_url: string | null;
  read_time_minutes: number;
  featured: boolean;
  trending: boolean;
  status: ArticleStatus;
  published_at: string | null;
  blocks?: UpsertBlockPayload[];
  /** Tag names; created on the fly */
  tags?: string[];
}

export interface UpsertBlockPayload {
  id?: number;
  position: number;
  type: ContentBlockType;
  data: ContentBlockData;
}

export interface UpsertAuthorPayload {
  name: string;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
  email: string | null;
  social_links?: SocialLinks | null;
  // If provided, creates/links a user account for this author
  user_email?: string;
  user_role?: AdminRole;
}

// ── Admin API response types ─────────────────────────────────

export type AuthRequestCodeResponse = ApiSuccess<{ message: string }>;
export type AuthVerifyCodeResponse = ApiSuccess<{
  token: string;
  user: AdminUser;
}>;
export type DashboardResponse = ApiSuccess<DashboardStats>;
export type AdminArticlesResponse = PaginatedResponse<AdminArticle>;
export type AdminArticleResponse = ApiSuccess<
  AdminArticle & { blocks: ContentBlock[]; tags?: string[] }
>;
export type AdminAuthorsResponse = ApiSuccess<AdminAuthor[]>;
export type AdminAuthorResponse = ApiSuccess<AdminAuthor>;
export type AdminMeResponse = ApiSuccess<AdminUser>;
export type AdminFeaturedCountResponse = ApiSuccess<{ count: number }>;

export interface AdminComment {
  id: number;
  article_id: number;
  article_title: string;
  article_slug: string;
  author_name: string | null;
  author_email: string | null;
  content: string;
  status: "pending" | "approved" | "spam";
  created_at: string;
}

export type AdminCommentsResponse = PaginatedResponse<AdminComment>;

export interface AdminSettingsItem {
  setting_key: string;
  setting_value: string | null;
  setting_type: string;
  description: string | null;
  updated_at: string;
}

export type AdminSettingsResponse = ApiSuccess<AdminSettingsItem[]>;

export interface NewsletterSubscriber {
  id: number;
  email: string;
  name: string | null;
  source: string | null;
  status: "pending" | "active" | "unsubscribed";
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export type AdminNewsletterResponse = PaginatedResponse<NewsletterSubscriber>;

export interface MediaVariant {
  width: number;
  url: string;
}

export interface UploadedMedia {
  id: number;
  url: string;
  width?: number;
  height?: number;
  variants?: MediaVariant[];
}

export type AdminUploadResponse = ApiSuccess<UploadedMedia>;

// ── Public page consolidated response types ──────────────────

export interface ArticleFullData {
  article: Article;
  blocks: ContentBlock[];
  related: Article[];
  tags?: Tag[];
}

export interface TagPageData {
  tag: Tag;
  articles: Article[];
}
export type TagPageResponse = ApiSuccess<TagPageData>;

export interface ArticleRevision {
  id: number;
  article_id: number;
  title: string;
  status: ArticleStatus;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}
export type ArticleRevisionsResponse = ApiSuccess<ArticleRevision[]>;

export interface AuditEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}
export type AuditLogResponse = PaginatedResponse<AuditEntry>;
export type ArticleFullResponse = ApiSuccess<ArticleFullData>;

export interface CategoryPageData {
  category: Category;
  articles: Article[];
  trending: Article[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
export type CategoryPageResponse = ApiSuccess<CategoryPageData>;

export interface NewsletterSubscribePayload {
  email: string;
  source?: string;
  /** Honeypot — must stay empty */
  website?: string;
}

export type NewsletterSubscribeResponse = ApiSuccess<{ message: string }>;

// ── Comments ─────────────────────────────────────────────────

export interface Comment {
  id: number;
  article_id: number;
  parent_id: number | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

export type CommentsResponse = ApiSuccess<Comment[]>;

export interface CreateCommentPayload {
  author_name: string;
  author_email?: string;
  content: string;
  parent_id?: number;
  /** Honeypot — must stay empty */
  website?: string;
}

export type CreateCommentResponse = ApiSuccess<{
  message: string;
  id: number;
}>;
