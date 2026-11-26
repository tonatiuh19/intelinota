/**
 * Central type definitions for the Redux store.
 * Kept in a separate file to avoid circular imports between
 * store/index.ts (which imports reducers) and slice files
 * (which need RootState for selectors).
 */
import type {
  Article,
  ContentBlock,
  Category,
  HomeMeta,
  AdminUser,
  AdminArticle,
  AdminAuthor,
  DashboardStats,
} from "@shared/api";

export interface ArticlesState {
  items: Article[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  listLoading: boolean;
  listError: string | null;
  categoryFilter: string | null;
  current: Article | null;
  detailLoading: boolean;
  detailError: string | null;
  currentBlocks: ContentBlock[];
  blocksLoading: boolean;
  currentRelated: Article[];
  currentTags: import("@shared/api").Tag[];
  // Consolidated category page (category + articles + trending)
  categoryPageSlug: string | null;
  categoryPageSubcategory: string | null;
  categoryPagePage: number;
  categoryPageCategory: Category | null;
  categoryPageArticles: Article[];
  categoryPageTrending: Article[];
  categoryPagePagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  categoryPageLoading: boolean;
  categoryPageError: string | null;
}

export interface CategoriesState {
  items: Category[];
  loading: boolean;
  error: string | null;
}

export interface HomeState {
  featured: Article[];
  trending: Article[];
  mostRead: Article[];
  articles: Article[];
  categories: Category[];
  meta: HomeMeta | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

// ── Admin Store Types ────────────────────────────────────────

export interface AdminAuthState {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  meLoading: boolean;
  error: string | null;
  codeSent: boolean;
  codeSentEmail: string | null;
}

export interface AdminArticlesState {
  items: AdminArticle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  loading: boolean;
  error: string | null;
  current:
    | (AdminArticle & { blocks: import("@shared/api").ContentBlock[]; tags?: string[] })
    | null;
  currentLoading: boolean;
  currentError: string | null;
  saving: boolean;
  saveError: string | null;
  deleteError: string | null;
  featuredCount: number | null;
}

export interface AdminAuthorsState {
  items: AdminAuthor[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
  deleteError: string | null;
}

export interface AdminCommentsState {
  items: import("@shared/api").AdminComment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  status: string;
  loading: boolean;
  error: string | null;
  patching: boolean;
}

export interface AdminCategoriesState {
  items: import("@shared/api").Category[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
}

export interface AdminNewsletterState {
  items: import("@shared/api").NewsletterSubscriber[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  loading: boolean;
  error: string | null;
}

export interface AdminSettingsState {
  items: import("@shared/api").AdminSettingsItem[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
}

export interface AdminDashboardState {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
}

export interface AuthorsState {
  list: import("@shared/api").Author[];
  listLoading: boolean;
  listError: string | null;
  current: import("@shared/api").Author & {
    articles: import("@shared/api").Article[];
  } | null;
  loading: boolean;
  error: string | null;
  currentSlug: string | null;
}

export interface SearchPageState {
  params: import("@shared/api").SearchParams | null;
  results: import("@shared/api").Article[];
  total: number;
  totalPages: number;
  facets: { categories: import("@shared/api").SearchFacet[]; authors: import("@shared/api").SearchFacet[] };
  loading: boolean;
  error: string | null;
  tookMs: number | null;
}

export interface TagsState {
  current: import("@shared/api").TagPageData | null;
  loading: boolean;
  error: string | null;
}

export interface RevisionsState {
  articleId: number | null;
  items: import("@shared/api").ArticleRevision[];
  loading: boolean;
  restoringId: number | null;
  error: string | null;
}

export interface AdminAuditState {
  items: import("@shared/api").AuditEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number } | null;
  loading: boolean;
  error: string | null;
}

export interface SearchState {
  query: string;
  results: import("@shared/api").Article[];
  loading: boolean;
  error: string | null;
  recent: string[];
}

export type ThemePreference = "light" | "dark" | "system";

export interface UiState {
  theme: ThemePreference;
  searchOpen: boolean;
}

export interface AdminMediaState {
  uploading: number;
  lastUrl: string | null;
  error: string | null;
}

export interface NewsletterState {
  status: "idle" | "submitting" | "succeeded" | "failed";
  message: string | null;
  error: string | null;
  /** Which form instance (source) the current status belongs to */
  source: string | null;
}

export interface CommentsState {
  items: import("@shared/api").Comment[];
  loading: boolean;
  posting: boolean;
  error: string | null;
  postMessage: string | null;
  articleSlug: string | null;
}

export interface RootState {
  articles: ArticlesState;
  categories: CategoriesState;
  home: HomeState;
  authors: AuthorsState;
  comments: CommentsState;
  newsletter: NewsletterState;
  adminAuth: AdminAuthState;
  adminArticles: AdminArticlesState;
  adminAuthors: AdminAuthorsState;
  adminComments: AdminCommentsState;
  adminCategories: AdminCategoriesState;
  adminNewsletter: AdminNewsletterState;
  adminSettings: AdminSettingsState;
  adminDashboard: AdminDashboardState;
  adminMedia: AdminMediaState;
  ui: UiState;
  search: SearchState;
  tags: TagsState;
  searchPage: SearchPageState;
  revisions: RevisionsState;
  adminAudit: AdminAuditState;
}
