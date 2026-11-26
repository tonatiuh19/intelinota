import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import axios from "@/lib/apiClient";
import type { AuditLogResponse } from "@shared/api";
import type { AdminAuditFilters, AdminAuditState, RootState } from "../types";

const PAGE_SIZE = 40;

const initialState: AdminAuditState = {
  items: [],
  pagination: null,
  filters: { user_id: null, type: null, from: null, to: null },
  users: [],
  loading: false,
  loadingMore: false,
  error: null,
};

/** page 1 replaces the list; later pages append ("Cargar más"). */
export const fetchAuditLog = createAsyncThunk(
  "adminAudit/fetch",
  async (page: number = 1, { getState, rejectWithValue }) => {
    const { filters } = (getState() as RootState).adminAudit;
    try {
      const { data } = await axios.get<AuditLogResponse>("/api/admin/audit", {
        params: {
          page,
          limit: PAGE_SIZE,
          include_mcp: 1,
          user_id: filters.user_id ?? undefined,
          type: filters.type ?? undefined,
          from: filters.from ?? undefined,
          to: filters.to ?? undefined,
        },
      });
      return data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "No se pudo cargar la actividad");
    }
  },
);

const entryKey = (i: { source?: string; id: number }) => `${i.source ?? "audit"}-${i.id}`;

const adminAuditSlice = createSlice({
  name: "adminAudit",
  initialState,
  reducers: {
    setAuditFilters(s, a: PayloadAction<Partial<AdminAuditFilters>>) {
      s.filters = { ...s.filters, ...a.payload };
    },
    resetAuditFilters(s) {
      s.filters = initialState.filters;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchAuditLog.pending, (s, a) => {
      if ((a.meta.arg ?? 1) > 1) s.loadingMore = true;
      else s.loading = true;
      s.error = null;
    })
      .addCase(fetchAuditLog.fulfilled, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        const page = a.payload.pagination.page;
        if (page > 1) {
          const seen = new Set(s.items.map(entryKey));
          s.items.push(...a.payload.data.filter((i) => !seen.has(entryKey(i))));
        } else {
          s.items = a.payload.data;
        }
        if (a.payload.users) s.users = a.payload.users;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchAuditLog.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        if (a.meta.aborted) return;
        s.error = (a.payload as string) ?? "Error";
      });
  },
});

export const { setAuditFilters, resetAuditFilters } = adminAuditSlice.actions;
export default adminAuditSlice.reducer;
