import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "@/lib/apiClient";
import type { AuditLogResponse } from "@shared/api";
import type { AdminAuditState } from "../types";

const initialState: AdminAuditState = {
  items: [],
  pagination: null,
  loading: false,
  error: null,
};

export const fetchAuditLog = createAsyncThunk(
  "adminAudit/fetch",
  async (page: number = 1, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<AuditLogResponse>("/api/admin/audit", {
        params: { page, limit: 50 },
      });
      return data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "No se pudo cargar la actividad");
    }
  },
);

const adminAuditSlice = createSlice({
  name: "adminAudit",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchAuditLog.pending, (s) => {
      s.loading = true;
      s.error = null;
    })
      .addCase(fetchAuditLog.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload.data;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchAuditLog.rejected, (s, a) => {
        s.loading = false;
        s.error = (a.payload as string) ?? "Error";
      });
  },
});

export default adminAuditSlice.reducer;
