import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type {
  CommentsResponse,
  CreateCommentPayload,
  CreateCommentResponse,
} from "@shared/api";
import type { CommentsState, RootState } from "../types";

const initialState: CommentsState = {
  items: [],
  loading: false,
  posting: false,
  error: null,
  postMessage: null,
  articleSlug: null,
};

export const fetchComments = createAsyncThunk(
  "comments/fetch",
  async (slug: string, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<CommentsResponse>(
        `/api/articles/${slug}/comments`,
      );
      return { slug, comments: data.data };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "No se pudieron cargar los comentarios",
      );
    }
  },
  {
    condition: (slug, { getState }) => {
      const s = (getState() as RootState).comments;
      if (s.loading) return false;
      if (s.articleSlug === slug) return false;
      return true;
    },
  },
);

export const postComment = createAsyncThunk(
  "comments/post",
  async (
    { slug, payload }: { slug: string; payload: CreateCommentPayload },
    { rejectWithValue, dispatch },
  ) => {
    try {
      const { data } = await axios.post<CreateCommentResponse>(
        `/api/articles/${slug}/comments`,
        payload,
      );
      dispatch(clearPostMessage());
      return { slug, message: data.data.message };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "No se pudo enviar el comentario",
      );
    }
  },
);

const commentsSlice = createSlice({
  name: "comments",
  initialState,
  reducers: {
    clearComments(state) {
      state.items = [];
      state.error = null;
      state.postMessage = null;
      state.articleSlug = null;
    },
    clearPostMessage(state) {
      state.postMessage = null;
    },
    invalidateComments(state) {
      state.articleSlug = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchComments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchComments.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.comments;
        state.articleSlug = action.payload.slug;
      })
      .addCase(fetchComments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.items = [];
      })
      .addCase(postComment.pending, (state) => {
        state.posting = true;
        state.error = null;
      })
      .addCase(postComment.fulfilled, (state, action) => {
        state.posting = false;
        state.postMessage = action.payload.message;
      })
      .addCase(postComment.rejected, (state, action) => {
        state.posting = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearComments, clearPostMessage, invalidateComments } =
  commentsSlice.actions;
export default commentsSlice.reducer;

export const selectComments = (s: RootState) => s.comments.items;
export const selectCommentsLoading = (s: RootState) => s.comments.loading;
export const selectCommentsPosting = (s: RootState) => s.comments.posting;
export const selectCommentsError = (s: RootState) => s.comments.error;
export const selectCommentsPostMessage = (s: RootState) =>
  s.comments.postMessage;
