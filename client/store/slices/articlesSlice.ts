import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type {
  Article,
  ArticlesResponse,
  ArticleResponse,
  ArticleBlocksResponse,
  ArticleFullResponse,
  CategoryPageResponse,
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
  trending: [],
  trendingLoading: false,
  featured: [],
  featuredLoading: false,
  currentRelated: [],
  categoryPageSlug: null,
  categoryPageArticles: [],
  categoryPageTrending: [],
  categoryPagePagination: null,
  categoryPageLoading: false,
  categoryPageError: null,
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

export const fetchArticleBlocks = createAsyncThunk(
  "articles/fetchBlocks",
  async (slug: string, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<ArticleBlocksResponse>(
        `/api/articles/${slug}/blocks`,
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch blocks",
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
      return data.data;
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

/**
 * Fetches category info + articles + trending in one request.
 * Skips re-fetch if the same category slug is already loaded.
 */
export const fetchCategoryPage = createAsyncThunk(
  "articles/fetchCategoryPage",
  async (params: { slug: string; page?: number }, { rejectWithValue }) => {
    try {
      const { slug, page = 1 } = params;
      const { data } = await axios.get<CategoryPageResponse>(
        `/api/category/${slug}`,
        { params: { page } },
      );
      return { ...data.data, slug };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch category",
      );
    }
  },
  {
    condition: ({ slug }, { getState }) => {
      const s = (getState() as RootState).articles;
      if (s.categoryPageLoading) return false;
      return s.categoryPageSlug !== slug;
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
      state.current = null;
      state.detailError = null;
      state.currentBlocks = [];
      state.blocksLoading = false;
      state.currentRelated = [];
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
        state.currentBlocks = [];
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

    // blocks
    builder
      .addCase(fetchArticleBlocks.pending, (state) => {
        state.blocksLoading = true;
      })
      .addCase(fetchArticleBlocks.fulfilled, (state, action) => {
        state.blocksLoading = false;
        state.currentBlocks = action.payload;
      })
      .addCase(fetchArticleBlocks.rejected, (state) => {
        state.blocksLoading = false;
        state.currentBlocks = [];
      });

    // article full (consolidated: article + blocks + related)
    builder
      .addCase(fetchArticleFull.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
        state.current = null;
        state.currentBlocks = [];
        state.currentRelated = [];
      })
      .addCase(fetchArticleFull.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.current = action.payload.article;
        state.currentBlocks = action.payload.blocks;
        state.currentRelated = action.payload.related;
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
      })
      .addCase(fetchCategoryPage.fulfilled, (state, action) => {
        state.categoryPageLoading = false;
        state.categoryPageSlug = action.payload.slug;
        state.categoryPageArticles = action.payload.articles;
        state.categoryPageTrending = action.payload.trending;
        state.categoryPagePagination = action.payload.pagination;
      })
      .addCase(fetchCategoryPage.rejected, (state, action) => {
        state.categoryPageLoading = false;
        state.categoryPageError = action.payload as string;
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

export const selectTrending = (s: RootState) => s.articles.trending;
export const selectFeatured = (s: RootState) => s.articles.featured;

export const selectByCategory = (category: string) => (s: RootState) =>
  s.articles.items.filter((a) => a.category_slug === category);

// Consolidated article detail
export const selectCurrentRelated = (s: RootState) => s.articles.currentRelated;

// Consolidated category page
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
