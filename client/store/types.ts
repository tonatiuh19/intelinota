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
  trending: Article[];
  trendingLoading: boolean;
  featured: Article[];
  featuredLoading: boolean;
  // Consolidated article detail (article + blocks + related)
  currentRelated: Article[];
  // Consolidated category page (category + articles + trending)
  categoryPageSlug: string | null;
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
    | (AdminArticle & { blocks: import("@shared/api").ContentBlock[] })
    | null;
  currentLoading: boolean;
  saving: boolean;
  saveError: string | null;
  featuredCount: number | null;
}

export interface AdminAuthorsState {
  items: AdminAuthor[];
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

export interface RootState {
  articles: ArticlesState;
  categories: CategoriesState;
  home: HomeState;
  adminAuth: AdminAuthState;
  adminArticles: AdminArticlesState;
  adminAuthors: AdminAuthorsState;
  adminDashboard: AdminDashboardState;
}
