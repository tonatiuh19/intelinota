import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import type { AdminNewsletterResponse, ApiSuccess, NewsletterStats } from "@shared/api";
import type { AdminNewsletterQuery, AdminNewsletterState, RootState } from "../types";

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });
const errMsg = (err: any, fallback: string): string => err?.response?.data?.message ?? fallback;

const initialState: AdminNewsletterState = {
  query: { page: 1, status: "all", q: "" },
  stats: null,
  statsLoading: false,
  busyIds: [],
  exporting: false,
  items: [],
  pagination: null,
  loading: false,
  error: null,
};

export const fetchAdminNewsletter = createAsyncThunk(
  "adminNewsletter/fetch",
  async (_: void, { getState, rejectWithValue, signal }) => {
    const state = getState() as RootState;
    const token = state.adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    const { page, status, q } = state.adminNewsletter.query;
    try {
      const { data } = await axios.get<AdminNewsletterResponse>("/api/admin/newsletter/subscribers", {
        params: { page, status: status === "all" ? undefined : status, q: q || undefined },
        headers: authHeader(token),
        signal,
      });
      return data;
    } catch (err) {
      return rejectWithValue(errMsg(err, "No se pudieron cargar los suscriptores"));
    }
  },
);

export const fetchNewsletterStats = createAsyncThunk(
  "adminNewsletter/stats",
  async (_: void, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<ApiSuccess<NewsletterStats>>("/api/admin/newsletter/stats", { headers: authHeader(token) });
      return data.data;
    } catch (err) {
      return rejectWithValue(errMsg(err, "No se pudieron cargar las estadísticas"));
    }
  },
);

/** Downloads the server-streamed CSV of active subscribers. */
export const exportNewsletterCsv = createAsyncThunk(
  "adminNewsletter/export",
  async (_: void, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const res = await axios.get<Blob>("/api/admin/newsletter/export.csv", { headers: authHeader(token), responseType: "blob" });
      const disposition = String(res.headers["content-disposition"] ?? "");
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "suscriptores-activos.csv";
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return filename;
    } catch (err) {
      return rejectWithValue(errMsg(err, "No se pudo exportar"));
    }
  },
);

export type SubscriberAction = "resend" | "unsubscribe" | "delete";

export const actOnSubscriber = createAsyncThunk(
  "adminNewsletter/act",
  async ({ id, action }: { id: number; action: SubscriberAction }, { getState, rejectWithValue, dispatch }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    const headers = authHeader(token);
    try {
      if (action === "delete") await axios.delete(`/api/admin/newsletter/subscribers/${id}`, { headers });
      else await axios.post(`/api/admin/newsletter/subscribers/${id}/${action}`, {}, { headers });
      if (action !== "resend") {
        dispatch(fetchAdminNewsletter());
        dispatch(fetchNewsletterStats());
      }
      return { id, action };
    } catch (err) {
      return rejectWithValue(errMsg(err, "No se pudo completar la acción"));
    }
  },
);

const adminNewsletterSlice = createSlice({
  name: "adminNewsletter",
  initialState,
  reducers: {
    setNewsletterQuery(state, action: PayloadAction<Partial<AdminNewsletterQuery>>) {
      const resetPage = action.payload.page === undefined;
      state.query = { ...state.query, ...action.payload, ...(resetPage ? { page: 1 } : {}) };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminNewsletter.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchAdminNewsletter.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload.data;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchAdminNewsletter.rejected, (s, a) => {
        if (a.meta.aborted) return;
        s.loading = false;
        s.error = a.payload as string;
      })
      .addCase(fetchNewsletterStats.pending, (s) => {
        s.statsLoading = true;
      })
      .addCase(fetchNewsletterStats.fulfilled, (s, a) => {
        s.statsLoading = false;
        s.stats = a.payload;
      })
      .addCase(fetchNewsletterStats.rejected, (s) => {
        s.statsLoading = false;
      })
      .addCase(exportNewsletterCsv.pending, (s) => {
        s.exporting = true;
      })
      .addCase(exportNewsletterCsv.fulfilled, (s) => {
        s.exporting = false;
      })
      .addCase(exportNewsletterCsv.rejected, (s) => {
        s.exporting = false;
      })
      .addCase(actOnSubscriber.pending, (s, a) => {
        s.busyIds.push(a.meta.arg.id);
      })
      .addCase(actOnSubscriber.fulfilled, (s, a) => {
        s.busyIds = s.busyIds.filter((i) => i !== a.meta.arg.id);
      })
      .addCase(actOnSubscriber.rejected, (s, a) => {
        s.busyIds = s.busyIds.filter((i) => i !== a.meta.arg.id);
      });
  },
});

export const { setNewsletterQuery } = adminNewsletterSlice.actions;
export default adminNewsletterSlice.reducer;

export const selectAdminNewsletter = (s: RootState) => s.adminNewsletter.items;
export const selectAdminNewsletterLoading = (s: RootState) => s.adminNewsletter.loading;
export const selectAdminNewsletterPagination = (s: RootState) => s.adminNewsletter.pagination;
