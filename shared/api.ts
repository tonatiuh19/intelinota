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
  sort_order?: number;
}

/** Admin categories list item (GET /api/admin/categories). */
export interface AdminSubcategory extends Subcategory {
  sort_order: number;
  article_count: number;
}

export interface AdminCategory extends Omit<Category, "subcategories"> {
  updated_at: string;
  published_count: number;
  draft_count: number;
  article_count: number;
  subcategories: AdminSubcategory[];
}

export interface CategoryWritePayload {
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
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
  /** SEO overrides (fall back to title / excerpt when null) */
  meta_title?: string | null;
  meta_description?: string | null;
  updated_at?: string;
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

export interface SearchFacet {
  slug: string;
  name: string;
  count: number;
}

export type SearchSort = "relevance" | "recent" | "popular" | "oldest";
export type SearchSince = "24h" | "7d" | "30d" | "1y";
export type SearchRead = "short" | "medium" | "long";

export interface SearchParams {
  q: string;
  category?: string;
  author?: string;
  since?: SearchSince;
  read?: SearchRead;
  sort?: SearchSort;
  page?: number;
}

export type SearchResponse = PaginatedResponse<Article> & {
  facets?: { categories: SearchFacet[]; authors: SearchFacet[] };
};
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
  /** Admins always true; authors when granted "trusted author" */
  can_publish?: boolean;
  /** IANA zone, e.g. "America/Mexico_City" */
  newsroom_timezone?: string;
  bio?: string | null;
  twitter_handle?: string | null;
  social_links?: SocialLinks | null;
}

// Extended author with linked user info (for admin management page)
export interface AdminAuthor extends Author {
  email: string | null;
  user_id: number | null;
  user_role: AdminRole | null;
  can_publish?: boolean;
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
  meta_title?: string | null;
  meta_description?: string | null;
  /** Optimistic concurrency: the updated_at the editor loaded (ISO) */
  expected_updated_at?: string;
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
  /** Trusted author: may publish/schedule own articles (admin-only toggle) */
  can_publish?: boolean;
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
  AdminArticle & {
    blocks: ContentBlock[];
    tags?: string[];
    /** Caller's own unreviewed edit of this live article */
    pending_revision?: { id: number; created_at: string | null } | null;
  }
>;
export type AdminAuthorsResponse = ApiSuccess<AdminAuthor[]>;
export type AdminAuthorResponse = ApiSuccess<AdminAuthor>;
export type AdminMeResponse = ApiSuccess<AdminUser>;
export type AdminFeaturedCountResponse = ApiSuccess<{ count: number }>;

export type CommentStatus = "pending" | "approved" | "spam";
export type CommentFlag =
  | "links"
  | "blocked_word"
  | "shouting"
  | "repeated_chars"
  | "duplicate"
  | "burst"
  | "known_spammer"
  | "too_short"
  | "trusted"
  | "staff";

export interface AdminComment {
  id: number;
  article_id: number;
  article_title: string;
  article_slug: string;
  parent_id: number | null;
  parent_author: string | null;
  parent_excerpt: string | null;
  user_id: number | null;
  author_name: string | null;
  author_email: string | null;
  content: string;
  status: CommentStatus;
  /** 0–100 risk score computed when posted */
  spam_score: number;
  flags: CommentFlag[];
  /** Commenter history (by email) */
  author_approved: number;
  author_spam: number;
  created_at: string;
}

export interface AdminCommentCounts {
  pending: number;
  approved: number;
  spam: number;
  flagged_pending: number;
}

export type AdminCommentsResponse = PaginatedResponse<AdminComment> & { counts: AdminCommentCounts };

export type CommentBulkAction = "approve" | "spam" | "pending" | "delete";

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
  confirmed_at?: string | null;
  unsubscribed_at: string | null;
}

export type AdminNewsletterResponse = PaginatedResponse<NewsletterSubscriber>;

export interface NewsletterStats {
  counts: { active: number; pending: number; unsubscribed: number; new_7d: number; total: number };
  daily: Array<{ date: string; count: number }>;
  sources: Array<{ source: string; count: number }>;
}

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
/** Public GET /api/articles/:slug — `{ redirect }` when the slug was renamed */
export type ArticleFullResponse = ApiSuccess<ArticleFullData | ArticleRedirectData>;
export interface ArticleRedirectData {
  redirect: string;
}

// ── Newsroom workflow ────────────────────────────────────────

/** GET /api/admin/articles/slug-available?slug=&exclude_id= */
export type SlugAvailabilityResponse = ApiSuccess<{ available: boolean; suggestion: string }>;

/** POST/PUT /api/admin/articles — 200/201 save */
export interface ArticleSavedData {
  id: number;
  status: ArticleStatus;
  updated_at: string | null;
}
/** PUT /api/admin/articles/:id — 202 when a live edit needs review */
export interface ArticlePendingData {
  id: number;
  pending: true;
  revision_id: number;
}
export type ArticleSaveResponse = ApiSuccess<ArticleSavedData | ArticlePendingData>;
/** PUT 409 bodies */
export interface ArticleConflictError {
  success: false;
  code: "CONFLICT";
  message: string;
  data: { updated_at: string | null };
}

export interface ReviewQueueArticle {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  status: ArticleStatus;
  image_url: string | null;
  author_id: number;
  author_name: string;
  category_name: string;
  submitted_at: string | null;
  updated_at: string | null;
}

export interface ReviewSideText {
  title: string;
  excerpt: string | null;
  slug: string;
  /** Plain text of content + blocks */
  text: string;
}

export interface ReviewPendingEdit {
  /** Revision id */
  id: number;
  article_id: number;
  slug: string;
  status: ArticleStatus;
  author_id: number;
  author_name: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  submitted_at: string | null;
  current: ReviewSideText;
  proposed: ReviewSideText;
}

export interface ReviewQueueData {
  in_review: ReviewQueueArticle[];
  pending_edits: ReviewPendingEdit[];
  total: number;
}
export type ReviewQueueResponse = ApiSuccess<ReviewQueueData>;

export type ReviewNoteAction = "returned" | "approved" | "published" | "comment";
export interface ReviewNote {
  id: number;
  article_id: number;
  revision_id: number | null;
  user_id: number | null;
  action: ReviewNoteAction;
  note: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}
export type ReviewNotesResponse = ApiSuccess<ReviewNote[]>;

export interface ApproveArticlePayload {
  /** Future ISO → scheduled; omitted/past → published now */
  published_at?: string | null;
  note?: string;
}
export interface ReviewNotePayload {
  note: string;
}

export type AdminNotificationType =
  | "review.submitted"
  | "review.approved"
  | "review.published"
  | "review.returned"
  | "revision.submitted"
  | "revision.approved"
  | "revision.rejected";

export interface AdminNotification {
  id: number;
  type: AdminNotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
export type NotificationsResponse = ApiSuccess<{ items: AdminNotification[]; unread_count: number }>;

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

// ── Remote MCP (AI connectors) ───────────────────────────────

export interface McpRights {
  role: "admin" | "author";
  can_publish: boolean;
  can_approve_reviews: boolean;
  can_feature: boolean;
  can_moderate_comments: "all" | "own_articles";
  can_delete_comments: boolean;
  sees_articles: "all" | "own";
  live_edits: "applied_immediately" | "pending_review";
}

export interface McpConsentInfo {
  client_id: string;
  client_name: string;
  redirect_host: string;
  scope: string;
  user: { name: string | null; email: string; role: "admin" | "author" };
  rights: McpRights;
}

export interface McpConsentRequest {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  state: string;
  scope: string;
}

export interface McpConnection {
  id: number;
  client_id: string;
  client_name: string;
  scopes: string;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  refresh_expires_at: string | null;
}

export interface McpConnectionsData {
  connector_url: string;
  connections: McpConnection[];
}
