import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Article, ArticlesResponse, ArticleResponse } from "@shared/api";
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
  trending: [],
  trendingLoading: false,
  featured: [],
  featuredLoading: false,
};

// ── Thunks ───────────────────────────────────────────────────

export const fetchArticles = createAsyncThunk(
  "articles/fetchList",
  async (
    params: { category?: string; page?: number; limit?: number } | void,
    { rejectWithValue },
  ) => {
    try {
      const p = (params ?? {}) as {
        category?: string;
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

export const fetchArticle = createAsyncThunk(
  "articles/fetchOne",
  async (slug: string, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<ArticleResponse>(
        `/api/articles/${slug}`,
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Article not found",
      );
    }
  },
);

export const fetchTrending = createAsyncThunk(
  "articles/fetchTrending",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<ArticlesResponse>("/api/articles", {
        params: { trending: 1, limit: 5 },
      });
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch trending",
      );
    }
  },
);

export const fetchFeatured = createAsyncThunk(
  "articles/fetchFeatured",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<ArticlesResponse>("/api/articles", {
        params: { featured: 1, limit: 6 },
      });
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch featured",
      );
    }
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
      state.current = null;
      state.detailError = null;
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

    // detail
    builder
      .addCase(fetchArticle.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
        state.current = null;
      })
      .addCase(fetchArticle.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.current = action.payload;
      })
      .addCase(fetchArticle.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload as string;
      });

    // trending
    builder
      .addCase(fetchTrending.pending, (state) => {
        state.trendingLoading = true;
      })
      .addCase(fetchTrending.fulfilled, (state, action) => {
        state.trendingLoading = false;
        state.trending = action.payload;
      })
      .addCase(fetchTrending.rejected, (state) => {
        state.trendingLoading = false;
      });

    // featured
    builder
      .addCase(fetchFeatured.pending, (state) => {
        state.featuredLoading = true;
      })
      .addCase(fetchFeatured.fulfilled, (state, action) => {
        state.featuredLoading = false;
        state.featured = action.payload;
      })
      .addCase(fetchFeatured.rejected, (state) => {
        state.featuredLoading = false;
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

export const selectTrending = (s: RootState) => s.articles.trending;
export const selectFeatured = (s: RootState) => s.articles.featured;

export const selectByCategory = (category: string) => (s: RootState) =>
  s.articles.items.filter((a) => a.category_slug === category);
