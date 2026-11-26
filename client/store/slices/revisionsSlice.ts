import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "@/lib/apiClient";
import type { ArticleRevisionsResponse } from "@shared/api";
import type { RevisionsState } from "../types";

const initialState: RevisionsState = {
  articleId: null,
  items: [],
  loading: false,
  restoringId: null,
  error: null,
};

export const fetchRevisions = createAsyncThunk(
  "revisions/fetch",
  async (articleId: number, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<ArticleRevisionsResponse>(
        `/api/admin/articles/${articleId}/revisions`,
      );
      return { articleId, items: data.data };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "No se pudo cargar el historial");
    }
  },
);

export const restoreRevision = createAsyncThunk(
  "revisions/restore",
  async (
    { articleId, revisionId }: { articleId: number; revisionId: number },
    { rejectWithValue, dispatch },
  ) => {
    try {
      await axios.post(`/api/admin/articles/${articleId}/revisions/${revisionId}/restore`);
      dispatch(fetchRevisions(articleId));
      return revisionId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "No se pudo restaurar");
    }
  },
);

const revisionsSlice = createSlice({
  name: "revisions",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchRevisions.pending, (s, a) => {
      s.loading = true;
      s.error = null;
      if (s.articleId !== a.meta.arg) s.items = [];
    })
      .addCase(fetchRevisions.fulfilled, (s, a) => {
        s.loading = false;
        s.articleId = a.payload.articleId;
        s.items = a.payload.items;
      })
      .addCase(fetchRevisions.rejected, (s, a) => {
        s.loading = false;
        s.error = (a.payload as string) ?? "Error";
      })
      .addCase(restoreRevision.pending, (s, a) => {
        s.restoringId = a.meta.arg.revisionId;
      })
      .addCase(restoreRevision.fulfilled, (s) => {
        s.restoringId = null;
      })
      .addCase(restoreRevision.rejected, (s, a) => {
        s.restoringId = null;
        s.error = (a.payload as string) ?? "Error";
      });
  },
});

export default revisionsSlice.reducer;
