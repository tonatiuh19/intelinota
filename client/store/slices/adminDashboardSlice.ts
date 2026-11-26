import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { DashboardResponse } from "@shared/api";
import type { AdminDashboardState, RootState } from "../types";

const initialState: AdminDashboardState = {
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
      });
  },
});

export const selectDashboardStats = (s: RootState) => s.adminDashboard.stats;
export const selectDashboardLoading = (s: RootState) =>
  s.adminDashboard.loading;
export const selectDashboardError = (s: RootState) => s.adminDashboard.error;

export default adminDashboardSlice.reducer;
