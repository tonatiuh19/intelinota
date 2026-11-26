import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "@/lib/apiClient";
import type {
  ApproveArticlePayload,
  ReviewNotesResponse,
  ReviewQueueResponse,
} from "@shared/api";
import type { AdminReviewsState, RootState } from "../types";

const initialState: AdminReviewsState = {
  queue: null,
  loading: false,
  error: null,
  actingKey: null,
  notesByArticle: {},
  notesLoading: false,
};

const message = (err: any, fallback: string): string =>
  err?.response?.data?.message ?? fallback;

export const fetchReviewQueue = createAsyncThunk(
  "adminReviews/fetchQueue",
  async (_: void, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<ReviewQueueResponse>("/api/admin/reviews");
      return data.data;
    } catch (err: any) {
      return rejectWithValue(message(err, "No se pudo cargar la cola de revisión"));
    }
  },
);

export const approveArticle = createAsyncThunk(
  "adminReviews/approveArticle",
  async (
    { id, ...payload }: { id: number } & ApproveArticlePayload,
    { rejectWithValue, dispatch },
  ) => {
    try {
      await axios.post(`/api/admin/articles/${id}/approve`, payload);
      dispatch(fetchReviewQueue());
      return id;
    } catch (err: any) {
      return rejectWithValue(message(err, "No se pudo aprobar el artículo"));
    }
  },
);

export const returnArticle = createAsyncThunk(
  "adminReviews/returnArticle",
  async ({ id, note }: { id: number; note: string }, { rejectWithValue, dispatch }) => {
    try {
      await axios.post(`/api/admin/articles/${id}/return`, { note });
      dispatch(fetchReviewQueue());
      return id;
    } catch (err: any) {
      return rejectWithValue(message(err, "No se pudo devolver el artículo"));
    }
  },
);

export const approveRevision = createAsyncThunk(
  "adminReviews/approveRevision",
  async ({ revId, note }: { revId: number; note?: string }, { rejectWithValue, dispatch }) => {
    try {
      await axios.post(`/api/admin/revisions/${revId}/approve`, note ? { note } : {});
      dispatch(fetchReviewQueue());
      return revId;
    } catch (err: any) {
      return rejectWithValue(message(err, "No se pudieron aplicar los cambios"));
    }
  },
);

export const rejectRevision = createAsyncThunk(
  "adminReviews/rejectRevision",
  async ({ revId, note }: { revId: number; note: string }, { rejectWithValue, dispatch }) => {
    try {
      await axios.post(`/api/admin/revisions/${revId}/reject`, { note });
      dispatch(fetchReviewQueue());
      return revId;
    } catch (err: any) {
      return rejectWithValue(message(err, "No se pudieron rechazar los cambios"));
    }
  },
);

/** Review feedback history for one article (owner or admin). */
export const fetchArticleNotes = createAsyncThunk(
  "adminReviews/fetchNotes",
  async (articleId: number, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<ReviewNotesResponse>(
        `/api/admin/articles/${articleId}/notes`,
      );
      return { articleId, notes: data.data };
    } catch (err: any) {
      return rejectWithValue(message(err, "No se pudieron cargar las notas"));
    }
  },
);

const keyOf = (type: string, arg: { id?: number; revId?: number }) =>
  type.includes("Revision") ? `revision:${arg.revId}` : `article:${arg.id}`;

const adminReviewsSlice = createSlice({
  name: "adminReviews",
  initialState,
  reducers: {
    clearReviewError(state) {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchReviewQueue.pending, (s) => {
      s.loading = true;
    })
      .addCase(fetchReviewQueue.fulfilled, (s, a) => {
        s.loading = false;
        s.error = null;
        s.queue = a.payload;
      })
      .addCase(fetchReviewQueue.rejected, (s, a) => {
        s.loading = false;
        s.error = (a.payload as string) ?? "Error";
      })
      .addCase(fetchArticleNotes.pending, (s) => {
        s.notesLoading = true;
      })
      .addCase(fetchArticleNotes.fulfilled, (s, a) => {
        s.notesLoading = false;
        s.notesByArticle[a.payload.articleId] = a.payload.notes;
      })
      .addCase(fetchArticleNotes.rejected, (s) => {
        s.notesLoading = false;
      });

    for (const thunk of [approveArticle, returnArticle, approveRevision, rejectRevision]) {
      b.addCase(thunk.pending, (s, a) => {
        s.actingKey = keyOf(thunk.typePrefix, a.meta.arg as { id?: number; revId?: number });
        s.error = null;
      })
        .addCase(thunk.fulfilled, (s) => {
          s.actingKey = null;
        })
        .addCase(thunk.rejected, (s, a) => {
          s.actingKey = null;
          s.error = (a.payload as string) ?? "Error";
        });
    }
  },
});

export const { clearReviewError } = adminReviewsSlice.actions;

export const selectReviewQueue = (s: RootState) => s.adminReviews.queue;
export const selectReviewCount = (s: RootState) => s.adminReviews.queue?.total ?? 0;
export const selectReviewsLoading = (s: RootState) => s.adminReviews.loading;
export const selectReviewsError = (s: RootState) => s.adminReviews.error;
export const selectReviewActingKey = (s: RootState) => s.adminReviews.actingKey;
export const selectArticleNotes = (articleId: number) => (s: RootState) =>
  s.adminReviews.notesByArticle[articleId] ?? [];

export default adminReviewsSlice.reducer;
