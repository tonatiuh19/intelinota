import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { AdminCommentsResponse } from "@shared/api";
import type { AdminCommentsState, RootState } from "../types";

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const initialState: AdminCommentsState = {
  items: [],
  pagination: null,
  status: "pending",
  loading: false,
  error: null,
  patching: false,
};

export const fetchAdminComments = createAsyncThunk(
  "adminComments/fetch",
  async (
    params: { status?: string; page?: number } = {},
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const status = params.status ?? "pending";
      const { data } = await axios.get<AdminCommentsResponse>(
        "/api/admin/comments",
        {
          params: { status, page: params.page ?? 1 },
          headers: authHeader(token),
        },
      );
      return { ...data, status };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch comments",
      );
    }
  },
);

export const patchAdminComment = createAsyncThunk(
  "adminComments/patch",
  async (
    { id, status }: { id: number; status: string },
    { getState, rejectWithValue, dispatch },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.patch(
        `/api/admin/comments/${id}`,
        { status },
        { headers: authHeader(token) },
      );
      const currentStatus = (getState() as RootState).adminComments.status;
      dispatch(fetchAdminComments({ status: currentStatus }));
      return id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to update comment",
      );
    }
  },
);

const adminCommentsSlice = createSlice({
  name: "adminComments",
  initialState,
  reducers: {
    setCommentsStatus(state, action) {
      state.status = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminComments.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchAdminComments.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload.data;
        s.pagination = a.payload.pagination;
        s.status = a.payload.status;
      })
      .addCase(fetchAdminComments.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload as string;
      })
      .addCase(patchAdminComment.pending, (s) => {
        s.patching = true;
      })
      .addCase(patchAdminComment.fulfilled, (s) => {
        s.patching = false;
      })
      .addCase(patchAdminComment.rejected, (s) => {
        s.patching = false;
      });
  },
});

export const { setCommentsStatus } = adminCommentsSlice.actions;
export default adminCommentsSlice.reducer;

export const selectAdminComments = (s: RootState) => s.adminComments.items;
export const selectAdminCommentsLoading = (s: RootState) =>
  s.adminComments.loading;
export const selectAdminCommentsError = (s: RootState) => s.adminComments.error;
export const selectAdminCommentsStatus = (s: RootState) =>
  s.adminComments.status;
export const selectAdminCommentsPagination = (s: RootState) =>
  s.adminComments.pagination;
