import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import axios from "@/lib/apiClient";
import type { AdminComment, AdminCommentsResponse, CommentBulkAction, CommentStatus } from "@shared/api";
import type { AdminCommentsQuery, AdminCommentsState, RootState } from "../types";

const initialState: AdminCommentsState = {
  items: [],
  pagination: null,
  counts: { pending: 0, approved: 0, spam: 0, flagged_pending: 0 },
  query: { status: "pending", q: "", flagged: false, sort: "recent", page: 1 },
  loading: false,
  error: null,
  busyIds: [],
};

export const fetchAdminComments = createAsyncThunk(
  "adminComments/fetch",
  async (_: void, { getState, rejectWithValue, signal }) => {
    const { query } = (getState() as RootState).adminComments;
    try {
      const { data } = await axios.get<AdminCommentsResponse>("/api/admin/comments", {
        signal,
        params: {
          status: query.status,
          q: query.q || undefined,
          flagged: query.flagged ? 1 : undefined,
          sort: query.sort,
          page: query.page,
          limit: 25,
        },
      });
      return data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "No se pudieron cargar los comentarios");
    }
  },
);

/** Moderate one or many comments. Optimistic: rows leave the current tab at once. */
export const moderateComments = createAsyncThunk(
  "adminComments/moderate",
  async ({ ids, action }: { ids: number[]; action: CommentBulkAction }, { dispatch, rejectWithValue }) => {
    try {
      await axios.post("/api/admin/comments/bulk", { ids, action });
      dispatch(fetchAdminComments());
      return { ids, action };
    } catch (err: any) {
      dispatch(fetchAdminComments());
      return rejectWithValue(err.response?.data?.message ?? "No se pudo moderar");
    }
  },
);

export const replyToComment = createAsyncThunk(
  "adminComments/reply",
  async ({ id, content }: { id: number; content: string }, { dispatch, rejectWithValue }) => {
    try {
      await axios.post(`/api/admin/comments/${id}/reply`, { content });
      dispatch(fetchAdminComments());
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "No se pudo responder");
    }
  },
);

const ACTION_STATUS: Record<CommentBulkAction, CommentStatus | null> = {
  approve: "approved",
  spam: "spam",
  pending: "pending",
  delete: null,
};

const adminCommentsSlice = createSlice({
  name: "adminComments",
  initialState,
  reducers: {
    setCommentsQuery(state, action: PayloadAction<Partial<AdminCommentsQuery>>) {
      const resetPage = !("page" in action.payload);
      state.query = { ...state.query, ...action.payload, ...(resetPage ? { page: 1 } : {}) };
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchAdminComments.pending, (s) => {
      s.loading = true;
      s.error = null;
    })
      .addCase(fetchAdminComments.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload.data;
        s.pagination = a.payload.pagination;
        s.counts = a.payload.counts ?? s.counts;
      })
      .addCase(fetchAdminComments.rejected, (s, a) => {
        if (a.meta.aborted) return;
        s.loading = false;
        s.error = (a.payload as string) ?? "Error";
      })
      .addCase(moderateComments.pending, (s, a) => {
        const { ids, action } = a.meta.arg;
        s.busyIds.push(...ids);
        const next = ACTION_STATUS[action];
        // Optimistic: drop rows that no longer belong in this tab
        s.items = s.items
          .map((c): AdminComment => (ids.includes(c.id) && next ? { ...c, status: next } : c))
          .filter((c) => !ids.includes(c.id) || (next !== null && (s.query.status === "all" || s.query.status === next)));
      })
      .addCase(moderateComments.fulfilled, (s, a) => {
        s.busyIds = s.busyIds.filter((id) => !a.payload.ids.includes(id));
      })
      .addCase(moderateComments.rejected, (s, a) => {
        s.busyIds = s.busyIds.filter((id) => !a.meta.arg.ids.includes(id));
        s.error = (a.payload as string) ?? "Error";
      })
      .addCase(replyToComment.pending, (s, a) => {
        s.busyIds.push(a.meta.arg.id);
      })
      .addCase(replyToComment.fulfilled, (s, a) => {
        s.busyIds = s.busyIds.filter((id) => id !== a.payload);
      })
      .addCase(replyToComment.rejected, (s, a) => {
        s.busyIds = s.busyIds.filter((id) => id !== a.meta.arg.id);
        s.error = (a.payload as string) ?? "Error";
      });
  },
});

export const { setCommentsQuery } = adminCommentsSlice.actions;
export default adminCommentsSlice.reducer;
