import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type {
  Article,
  ArticlesResponse,
  ArticleFullResponse,
  CategoryPageResponse,
  Category,
} from "@shared/api";
import type { RootState, ArticlesState } from "../types";

export type { ArticlesState };

const initialState: ArticlesState = {
  items: [],
  pagination: null,
  listLoading: false,
  listError: null,
  categoryFilter: null,
  current: null,
  detailLoading: false,
  detailError: null,
  currentBlocks: [],
  blocksLoading: false,
  currentRelated: [],
  currentTags: [],
  categoryPageSlug: null,
  categoryPageSubcategory: null,
  categoryPagePage: 1,
  categoryPageCategory: null,
  categoryPageArticles: [],
  categoryPageTrending: [],
  categoryPagePagination: null,
  categoryPageLoading: false,
  categoryPageError: null,
  categoryRedirect: null,
  redirectSlug: null,
};

// ── Thunks ───────────────────────────────────────────────────

export const fetchArticles = createAsyncThunk(
  "articles/fetchList",
  async (
    params:
      | {
          category?: string;
          search?: string;
          slugs?: string;
          page?: number;
          limit?: number;
        }
      | void,
    { rejectWithValue },
  ) => {
    try {
      const p = (params ?? {}) as {
        category?: string;
        search?: string;
        slugs?: string;
        page?: number;
        limit?: number;
      };
      const { data } = await axios.get<ArticlesResponse>("/api/articles", {
        params: { ...p, limit: p.limit ?? 20 },
      });
      return data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch articles",
      );
    }
  },
);

/**
 * Fetches article + blocks + related in one request.
 * Skips fetch if the same article is already loaded.
 */
export const fetchArticleFull = createAsyncThunk(
  "articles/fetchFull",
  async (slug: string, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<ArticleFullResponse>(
        `/api/articles/${slug}`,
      );
      const payload = data.data;
      if ("redirect" in payload) {
        return { kind: "redirect" as const, redirect: payload.redirect };
      }
      return { kind: "article" as const, ...payload };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Article not found",
      );
    }
  },
  {
    condition: (slug, { getState }) => {
      const s = (getState() as RootState).articles;
      if (s.detailLoading) return false;
      if (s.current?.slug === slug && s.currentBlocks.length > 0) return false;
      return true;
    },
  },
);

/** Counts a view (server dedupes per session and ignores bots). */
export const trackArticleView = createAsyncThunk(
  "articles/trackView",
  async (slug: string) => {
    try {
      await axios.post(`/api/articles/${encodeURIComponent(slug)}/view`);
    } catch {
      // Non-critical — never surface to the reader
    }
    return slug;
  },
);

/**
 * Fetches category info + articles + trending in one request.
 * Skips re-fetch if the same category slug is already loaded.
 */
export const fetchCategoryPage = createAsyncThunk(
  "articles/fetchCategoryPage",
  async (
    params: { slug: string; page?: number; subcategory?: string },
    { rejectWithValue },
  ) => {
    try {
      const { slug, page = 1, subcategory } = params;
      const { data } = await axios.get<CategoryPageResponse>(
        `/api/category/${slug}`,
        {
          params: {
            page,
            ...(subcategory ? { subcategory } : {}),
          },
        },
      );
      return { ...data.data, slug, page, subcategory: subcategory ?? null };
    } catch (err: any) {
      if (err.response?.data?.redirect) {
        return rejectWithValue({ redirect: String(err.response.data.redirect) });
      }
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch category",
      );
    }
  },
  {
    condition: ({ slug, page = 1, subcategory }, { getState }) => {
      const s = (getState() as RootState).articles;
      if (s.categoryPageLoading) return false;
      return !(
        s.categoryPageSlug === slug &&
        s.categoryPagePage === page &&
        s.categoryPageSubcategory === (subcategory ?? null)
      );
    },
  },
);

// ── Slice ────────────────────────────────────────────────────

const articlesSlice = createSlice({
  name: "articles",
  initialState,
  reducers: {
    setCategoryFilter(state, action) {
      state.categoryFilter = action.payload;
    },
    clearCurrent(state) {
      state.redirectSlug = null;
      state.current = null;
      state.detailError = null;
      state.currentBlocks = [];
      state.blocksLoading = false;
      state.currentRelated = [];
      state.currentTags = [];
    },
  },
  extraReducers: (builder) => {
    // list
    builder
      .addCase(fetchArticles.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        state.listLoading = false;
        state.items = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload as string;
      });

    // article full (consolidated: article + blocks + related)
    builder
      .addCase(fetchArticleFull.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
        state.current = null;
        state.currentBlocks = [];
        state.currentRelated = [];
      state.currentTags = [];
      })
      .addCase(fetchArticleFull.fulfilled, (state, action) => {
        state.detailLoading = false;
        if (action.payload.kind === "redirect") {
          state.redirectSlug = action.payload.redirect;
          return;
        }
        state.redirectSlug = null;
        state.current = action.payload.article;
        state.currentBlocks = action.payload.blocks;
        state.currentRelated = action.payload.related;
        state.currentTags = action.payload.tags ?? [];
      })
      .addCase(fetchArticleFull.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload as string;
      });

    // category page (consolidated: category + articles + trending)
    builder
      .addCase(fetchCategoryPage.pending, (state) => {
        state.categoryPageLoading = true;
        state.categoryPageError = null;
        state.categoryRedirect = null;
      })
      .addCase(fetchCategoryPage.fulfilled, (state, action) => {
        state.categoryPageLoading = false;
        state.categoryPageSlug = action.payload.slug;
        state.categoryPagePage = action.payload.page;
        state.categoryPageSubcategory = action.payload.subcategory;
        state.categoryPageCategory = action.payload.category;
        state.categoryPageArticles = action.payload.articles;
        state.categoryPageTrending = action.payload.trending;
        state.categoryPagePagination = action.payload.pagination;
      })
      .addCase(fetchCategoryPage.rejected, (state, action) => {
        state.categoryPageLoading = false;
        const p = action.payload as string | { redirect: string } | undefined;
        if (p && typeof p === "object" && "redirect" in p) {
          state.categoryRedirect = p.redirect;
          state.categoryPageError = null;
        } else {
          state.categoryPageError = (p as string) ?? "Error";
        }
      });
  },
});

export const { setCategoryFilter, clearCurrent } = articlesSlice.actions;
export default articlesSlice.reducer;

// ── Selectors ────────────────────────────────────────────────

export const selectArticles = (s: RootState) => s.articles.items;
export const selectPagination = (s: RootState) => s.articles.pagination;
export const selectListLoading = (s: RootState) => s.articles.listLoading;
export const selectListError = (s: RootState) => s.articles.listError;

export const selectCurrentArticle = (s: RootState) => s.articles.current;
export const selectDetailLoading = (s: RootState) => s.articles.detailLoading;
export const selectDetailError = (s: RootState) => s.articles.detailError;
export const selectCurrentBlocks = (s: RootState) => s.articles.currentBlocks;
export const selectBlocksLoading = (s: RootState) => s.articles.blocksLoading;

export const selectByCategory = (category: string) => (s: RootState) =>
  s.articles.items.filter((a) => a.category_slug === category);

// Consolidated article detail
export const selectCurrentRelated = (s: RootState) => s.articles.currentRelated;
export const selectCurrentTags = (s: RootState) => s.articles.currentTags;
export const selectRedirectSlug = (s: RootState) => s.articles.redirectSlug;

// Consolidated category page
export const selectCategoryPageCategory = (s: RootState) =>
  s.articles.categoryPageCategory;
export const selectCategoryPageArticles = (s: RootState) =>
  s.articles.categoryPageArticles;
export const selectCategoryPageTrending = (s: RootState) =>
  s.articles.categoryPageTrending;
export const selectCategoryPagePagination = (s: RootState) =>
  s.articles.categoryPagePagination;
export const selectCategoryPageLoading = (s: RootState) =>
  s.articles.categoryPageLoading;
export const selectCategoryPageError = (s: RootState) =>
  s.articles.categoryPageError;
