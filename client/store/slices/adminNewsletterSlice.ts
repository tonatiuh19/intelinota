import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { AdminNewsletterResponse } from "@shared/api";
import type { AdminNewsletterState, RootState } from "../types";

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const initialState: AdminNewsletterState = {
  items: [],
  pagination: null,
  loading: false,
  error: null,
};

export const fetchAdminNewsletter = createAsyncThunk(
  "adminNewsletter/fetch",
  async (
    params: { page?: number; status?: string } = {},
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<AdminNewsletterResponse>(
        "/api/admin/newsletter/subscribers",
        {
          params: { page: params.page ?? 1, status: params.status },
          headers: authHeader(token),
        },
      );
      return data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch subscribers",
      );
    }
  },
);

const adminNewsletterSlice = createSlice({
  name: "adminNewsletter",
  initialState,
  reducers: {},
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
        s.loading = false;
        s.error = a.payload as string;
      });
  },
});

export default adminNewsletterSlice.reducer;

export const selectAdminNewsletter = (s: RootState) => s.adminNewsletter.items;
export const selectAdminNewsletterLoading = (s: RootState) =>
  s.adminNewsletter.loading;
export const selectAdminNewsletterPagination = (s: RootState) =>
  s.adminNewsletter.pagination;
