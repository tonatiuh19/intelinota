import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type {
  AdminArticlesResponse,
  AdminArticleResponse,
  UpsertArticlePayload,
} from "@shared/api";
import type { AdminArticlesState, RootState } from "../types";

const initialState: AdminArticlesState = {
  items: [],
  pagination: null,
  loading: false,
  error: null,
  current: null,
  currentLoading: false,
  saving: false,
  saveError: null,
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
      })
      .addCase(fetchAdminArticle.fulfilled, (s, a) => {
        s.currentLoading = false;
        s.current = a.payload;
      })
      .addCase(fetchAdminArticle.rejected, (s) => {
        s.currentLoading = false;
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

    builder.addCase(deleteAdminArticle.fulfilled, (s, a) => {
      s.items = s.items.filter((i) => i.id !== a.payload);
    });

    builder.addCase(fetchFeaturedCount.fulfilled, (s, a) => {
      s.featuredCount = a.payload;
    });
  },
});

export const { clearCurrent, clearSaveError } = adminArticlesSlice.actions;

export const selectAdminArticles = (s: RootState) => s.adminArticles.items;
export const selectAdminArticlesPagination = (s: RootState) =>
  s.adminArticles.pagination;
export const selectAdminArticlesLoading = (s: RootState) =>
  s.adminArticles.loading;
export const selectAdminArticlesCurrent = (s: RootState) =>
  s.adminArticles.current;
export const selectAdminArticlesSaving = (s: RootState) =>
  s.adminArticles.saving;
export const selectAdminArticlesSaveError = (s: RootState) =>
  s.adminArticles.saveError;
export const selectAdminArticlesFeaturedCount = (s: RootState) =>
  s.adminArticles.featuredCount;

export default adminArticlesSlice.reducer;
