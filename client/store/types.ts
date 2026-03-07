/**
 * Central type definitions for the Redux store.
 * Kept in a separate file to avoid circular imports between
 * store/index.ts (which imports reducers) and slice files
 * (which need RootState for selectors).
 */
import type { Article, Category, HomeMeta } from "@shared/api";

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
  trending: Article[];
  trendingLoading: boolean;
  featured: Article[];
  featuredLoading: boolean;
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

export interface RootState {
  articles: ArticlesState;
  categories: CategoriesState;
  home: HomeState;
}
