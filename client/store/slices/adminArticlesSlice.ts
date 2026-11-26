import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type {
  AdminArticle,
  AdminArticlesResponse,
  AdminArticleResponse,
  ArticleStatus,
  UpsertArticlePayload,
} from "@shared/api";
import type { AdminArticlesState, RootState } from "../types";

/** Per-status counts for the list filter chips ("all" = every status). */
export type ArticleStatusCounts = Record<ArticleStatus | "all", number>;

/**
 * Local extension of the shared AdminArticlesState. Kept in this file so the
 * slice can grow without touching the shared store types.
 */
export interface AdminArticlesExtState extends AdminArticlesState {
  statusCounts: ArticleStatusCounts | null;
  /** Whether statusCounts are exact (false when estimated from first 100). */
  statusCountsExact: boolean;
  bulkWorking: boolean;
  duplicatingId: number | null;
}

export const ARTICLE_STATUSES: ArticleStatus[] = [
  "draft",
  "in_review",
  "scheduled",
  "published",
  "archived",
];

const initialState: AdminArticlesExtState = {
  statusCounts: null,
  statusCountsExact: true,
  bulkWorking: false,
  duplicatingId: null,
  items: [],
  pagination: null,
  loading: false,
  error: null,
  current: null,
  currentLoading: false,
  currentError: null,
  saving: false,
  saveError: null,
  deleteError: null,
  featuredCount: null,
};

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

export const fetchAdminArticles = createAsyncThunk(
  "adminArticles/fetchList",
  async (
    params: {
      page?: number;
      limit?: number;
      status?: string;
      category?: string;
      search?: string;
      /**
       * Restrict to one author. The API currently scopes authors to their own
       * articles but ignores this param for admins, so we also filter
       * client-side below.
       */
      author_id?: number;
    } = {},
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<AdminArticlesResponse>(
        "/api/admin/articles",
        { params, headers: authHeader(token) },
      );
      if (params.author_id != null) {
        const filtered = data.data.filter(
          (a) => a.author_id === params.author_id,
        );
        if (filtered.length !== data.data.length) {
          return { ...data, data: filtered };
        }
      }
      return data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch articles",
      );
    }
  },
);

export const fetchAdminArticle = createAsyncThunk(
  "adminArticles/fetchOne",
  async (id: number, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<AdminArticleResponse>(
        `/api/admin/articles/${id}`,
        { headers: authHeader(token) },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch article",
      );
    }
  },
);

export const createAdminArticle = createAsyncThunk(
  "adminArticles/create",
  async (payload: UpsertArticlePayload, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.post<{
        success: true;
        data: { id: number };
      }>("/api/admin/articles", payload, { headers: authHeader(token) });
      return data.data.id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to create article",
      );
    }
  },
);

export const updateAdminArticle = createAsyncThunk(
  "adminArticles/update",
  async (
    { id, payload }: { id: number; payload: Partial<UpsertArticlePayload> },
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.put(`/api/admin/articles/${id}`, payload, {
        headers: authHeader(token),
      });
      return id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to update article",
      );
    }
  },
);

export const fetchFeaturedCount = createAsyncThunk(
  "adminArticles/fetchFeaturedCount",
  async (_, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<{ success: true; count: number }>(
        "/api/admin/articles/featured-count",
        { headers: authHeader(token) },
      );
      return data.count;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch featured count",
      );
    }
  },
);

export const deleteAdminArticle = createAsyncThunk(
  "adminArticles/delete",
  async (id: number, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.delete(`/api/admin/articles/${id}`, {
        headers: authHeader(token),
      });
      return id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to delete article",
      );
    }
  },
);

const emptyCounts = (): ArticleStatusCounts => ({
  all: 0,
  draft: 0,
  in_review: 0,
  scheduled: 0,
  published: 0,
  archived: 0,
});

/**
 * Counts per status for the filter chips. Tries one 100-row request first and
 * counts client-side (exact when total ≤ 100 or when filtering by author on a
 * small set); otherwise falls back to one `limit=1` request per status.
 */
export const fetchAdminArticleCounts = createAsyncThunk(
  "adminArticles/fetchCounts",
  async (
    params: { search?: string; category?: string; author_id?: number } = {},
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    const { author_id, ...query } = params;
    try {
      const { data } = await axios.get<AdminArticlesResponse>(
        "/api/admin/articles",
        { params: { ...query, limit: 100, page: 1 }, headers: authHeader(token) },
      );
      const total = data.pagination?.total ?? data.data.length;
      if (total <= data.data.length || author_id != null) {
        const counts = emptyCounts();
        for (const a of data.data) {
          if (author_id != null && a.author_id !== author_id) continue;
          counts.all += 1;
          counts[a.status] = (counts[a.status] ?? 0) + 1;
        }
        return { counts, exact: total <= data.data.length };
      }
      const results = await Promise.all(
        ARTICLE_STATUSES.map((status) =>
          axios.get<AdminArticlesResponse>("/api/admin/articles", {
            params: { ...query, status, limit: 1, page: 1 },
            headers: authHeader(token),
          }),
        ),
      );
      const counts = emptyCounts();
      counts.all = total;
      results.forEach((r, i) => {
        counts[ARTICLE_STATUSES[i]] = r.data.pagination?.total ?? 0;
      });
      return { counts, exact: true };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch counts",
      );
    }
  },
);

/** Copy an existing article into a new draft (`<slug>-copia`). Returns new id. */
export const duplicateAdminArticle = createAsyncThunk(
  "adminArticles/duplicate",
  async (id: number, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<AdminArticleResponse>(
        `/api/admin/articles/${id}`,
        { headers: authHeader(token) },
      );
      const src = data.data;
      const payload: UpsertArticlePayload = {
        title: `${src.title} (copia)`,
        slug: `${src.slug}-copia`,
        excerpt: src.excerpt,
        content: src.content,
        category_id: src.category_id,
        subcategory_id: src.subcategory_id,
        author_id: src.author_id,
        image_url: src.image_url,
        read_time_minutes: src.read_time_minutes,
        featured: false,
        trending: false,
        status: "draft",
        published_at: null,
        blocks: (src.blocks ?? []).map((b) => ({
          position: b.position,
          type: b.type,
          data: b.data,
        })),
        tags: src.tags,
      };
      const { data: created } = await axios.post<{
        success: true;
        data: { id: number };
      }>("/api/admin/articles", payload, { headers: authHeader(token) });
      return created.data.id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "No se pudo duplicar el artículo",
      );
    }
  },
);

/** Archive several articles (DELETE archives). Returns archived ids. */
export const bulkArchiveAdminArticles = createAsyncThunk(
  "adminArticles/bulkArchive",
  async (ids: number[], { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    const results = await Promise.allSettled(
      ids.map((id) =>
        axios.delete(`/api/admin/articles/${id}`, {
          headers: authHeader(token),
        }),
      ),
    );
    const done = ids.filter((_, i) => results[i].status === "fulfilled");
    if (done.length === 0) {
      return rejectWithValue("No se pudo archivar ningún artículo");
    }
    return { done, failed: ids.length - done.length };
  },
);

const markArchived = (items: AdminArticle[], ids: number[]) => {
  for (const it of items) if (ids.includes(it.id)) it.status = "archived";
};

const adminArticlesSlice = createSlice({
  name: "adminArticles",
  initialState,
  reducers: {
    clearCurrent(state) {
      state.current = null;
      state.saveError = null;
    },
    clearSaveError(state) {
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminArticles.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchAdminArticles.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload.data;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchAdminArticles.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload as string;
      });

    builder
      .addCase(fetchAdminArticle.pending, (s) => {
        s.currentLoading = true;
        s.currentError = null;
      })
      .addCase(fetchAdminArticle.fulfilled, (s, a) => {
        s.currentLoading = false;
        s.current = a.payload;
        s.currentError = null;
      })
      .addCase(fetchAdminArticle.rejected, (s, a) => {
        s.currentLoading = false;
        s.current = null;
        s.currentError = a.payload as string;
      });

    builder
      .addCase(createAdminArticle.pending, (s) => {
        s.saving = true;
        s.saveError = null;
      })
      .addCase(createAdminArticle.fulfilled, (s) => {
        s.saving = false;
      })
      .addCase(createAdminArticle.rejected, (s, a) => {
        s.saving = false;
        s.saveError = a.payload as string;
      });

    builder
      .addCase(updateAdminArticle.pending, (s) => {
        s.saving = true;
        s.saveError = null;
      })
      .addCase(updateAdminArticle.fulfilled, (s) => {
        s.saving = false;
      })
      .addCase(updateAdminArticle.rejected, (s, a) => {
        s.saving = false;
        s.saveError = a.payload as string;
      });

    builder.addCase(deleteAdminArticle.pending, (s) => {
      s.deleteError = null;
    });
    builder.addCase(deleteAdminArticle.fulfilled, (s, a) => {
      s.items = s.items.filter((i) => i.id !== a.payload);
      s.deleteError = null;
    });
    builder.addCase(deleteAdminArticle.rejected, (s, a) => {
      s.deleteError = a.payload as string;
    });

    builder.addCase(fetchFeaturedCount.fulfilled, (s, a) => {
      s.featuredCount = a.payload;
    });

    builder.addCase(fetchAdminArticleCounts.fulfilled, (s, a) => {
      s.statusCounts = a.payload.counts;
      s.statusCountsExact = a.payload.exact;
    });

    builder
      .addCase(duplicateAdminArticle.pending, (s, a) => {
        s.duplicatingId = a.meta.arg;
      })
      .addCase(duplicateAdminArticle.fulfilled, (s) => {
        s.duplicatingId = null;
      })
      .addCase(duplicateAdminArticle.rejected, (s) => {
        s.duplicatingId = null;
      });

    builder
      .addCase(bulkArchiveAdminArticles.pending, (s) => {
        s.bulkWorking = true;
        s.deleteError = null;
      })
      .addCase(bulkArchiveAdminArticles.fulfilled, (s, a) => {
        s.bulkWorking = false;
        markArchived(s.items, a.payload.done);
        if (a.payload.failed > 0) {
          s.deleteError = `${a.payload.failed} artículo(s) no se pudieron archivar`;
        }
      })
      .addCase(bulkArchiveAdminArticles.rejected, (s, a) => {
        s.bulkWorking = false;
        s.deleteError = a.payload as string;
      });
  },
});

export const { clearCurrent, clearSaveError } = adminArticlesSlice.actions;

export const selectAdminArticles = (s: RootState) => s.adminArticles.items;
export const selectAdminArticlesPagination = (s: RootState) =>
  s.adminArticles.pagination;
export const selectAdminArticlesLoading = (s: RootState) =>
  s.adminArticles.loading;
export const selectAdminArticlesError = (s: RootState) => s.adminArticles.error;
export const selectAdminArticlesCurrent = (s: RootState) =>
  s.adminArticles.current;
export const selectAdminArticlesSaving = (s: RootState) =>
  s.adminArticles.saving;
export const selectAdminArticlesSaveError = (s: RootState) =>
  s.adminArticles.saveError;
export const selectAdminArticlesCurrentLoading = (s: RootState) =>
  s.adminArticles.currentLoading;
export const selectAdminArticlesCurrentError = (s: RootState) =>
  s.adminArticles.currentError;
export const selectAdminArticlesDeleteError = (s: RootState) =>
  s.adminArticles.deleteError;
export const selectAdminArticlesFeaturedCount = (s: RootState) =>
  s.adminArticles.featuredCount;

const ext = (s: RootState) => s.adminArticles as AdminArticlesExtState;
export const selectAdminArticleStatusCounts = (s: RootState) =>
  ext(s).statusCounts ?? null;
export const selectAdminArticleStatusCountsExact = (s: RootState) =>
  ext(s).statusCountsExact ?? true;
export const selectAdminArticlesBulkWorking = (s: RootState) =>
  ext(s).bulkWorking ?? false;
export const selectAdminArticlesDuplicatingId = (s: RootState) =>
  ext(s).duplicatingId ?? null;

export default adminArticlesSlice.reducer;
