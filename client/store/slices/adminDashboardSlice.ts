import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type {
  AdminArticle,
  AdminArticlesResponse,
  DashboardResponse,
} from "@shared/api";
import type { AdminDashboardState, RootState } from "../types";

/** Writer-centric numbers computed from the admin articles list. */
export interface WriterOverview {
  recentDrafts: AdminArticle[];
  scheduled: AdminArticle[];
  publishedCount: number;
  inReviewCount: number;
  draftCount: number;
  totalViews: number;
  /** False when the writer has >100 articles and numbers are partial. */
  exact: boolean;
}

/** Local extension of the shared dashboard state (kept out of store/types). */
export interface AdminDashboardExtState extends AdminDashboardState {
  writer: WriterOverview | null;
  writerLoading: boolean;
  writerError: string | null;
}

const initialState: AdminDashboardExtState = {
  writer: null,
  writerLoading: false,
  writerError: null,
  stats: null,
  loading: false,
  error: null,
};

export const fetchAdminDashboard = createAsyncThunk(
  "adminDashboard/fetch",
  async (_, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<DashboardResponse>(
        "/api/admin/dashboard",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to load dashboard",
      );
    }
  },
);

/**
 * Loads the current user's articles (authors are scoped server-side; admins
 * are filtered client-side by author_id) plus upcoming scheduled articles.
 */
export const fetchWriterOverview = createAsyncThunk(
  "adminDashboard/fetchWriter",
  async (_, { getState, rejectWithValue }) => {
    const { token, user } = (getState() as RootState).adminAuth;
    if (!token) return rejectWithValue("Not authenticated");
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [mine, sched] = await Promise.all([
        axios.get<AdminArticlesResponse>("/api/admin/articles", {
          params: { limit: 100, page: 1 },
          headers,
        }),
        axios.get<AdminArticlesResponse>("/api/admin/articles", {
          params: { status: "scheduled", limit: 50, page: 1 },
          headers,
        }),
      ]);
      const authorId = user?.author_id ?? null;
      const isAdmin = user?.role === "admin";
      const own = (a: AdminArticle) =>
        !isAdmin || (authorId != null && a.author_id === authorId);
      const my = mine.data.data.filter(own);
      const now = Date.now();
      const overview: WriterOverview = {
        recentDrafts: my
          .filter((a) => a.status === "draft")
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          )
          .slice(0, 3),
        scheduled: sched.data.data
          .filter((a) => !a.published_at || new Date(a.published_at).getTime() >= now - 60_000)
          .sort(
            (a, b) =>
              new Date(a.published_at ?? 0).getTime() -
              new Date(b.published_at ?? 0).getTime(),
          )
          .slice(0, 5),
        publishedCount: my.filter((a) => a.status === "published").length,
        inReviewCount: my.filter((a) => a.status === "in_review").length,
        draftCount: my.filter((a) => a.status === "draft").length,
        totalViews: my.reduce((n, a) => n + (a.view_count ?? 0), 0),
        exact: (mine.data.pagination?.total ?? 0) <= mine.data.data.length,
      };
      return overview;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to load writer overview",
      );
    }
  },
);

const adminDashboardSlice = createSlice({
  name: "adminDashboard",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminDashboard.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchAdminDashboard.fulfilled, (s, a) => {
        s.loading = false;
        s.stats = a.payload;
      })
      .addCase(fetchAdminDashboard.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload as string;
      })
      .addCase(fetchWriterOverview.pending, (s) => {
        s.writerLoading = true;
        s.writerError = null;
      })
      .addCase(fetchWriterOverview.fulfilled, (s, a) => {
        s.writerLoading = false;
        s.writer = a.payload;
      })
      .addCase(fetchWriterOverview.rejected, (s, a) => {
        s.writerLoading = false;
        s.writerError = a.payload as string;
      });
  },
});

export const selectDashboardStats = (s: RootState) => s.adminDashboard.stats;
export const selectDashboardLoading = (s: RootState) =>
  s.adminDashboard.loading;
export const selectDashboardError = (s: RootState) => s.adminDashboard.error;

const ext = (s: RootState) => s.adminDashboard as AdminDashboardExtState;
export const selectWriterOverview = (s: RootState) => ext(s).writer ?? null;
export const selectWriterLoading = (s: RootState) =>
  ext(s).writerLoading ?? false;
export const selectWriterError = (s: RootState) => ext(s).writerError ?? null;

export default adminDashboardSlice.reducer;
