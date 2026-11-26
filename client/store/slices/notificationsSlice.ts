import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "@/lib/apiClient";
import type { NotificationsResponse } from "@shared/api";
import type { NotificationsState, RootState } from "../types";

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,
  lastFetchedAt: null,
};

export const fetchNotifications = createAsyncThunk(
  "notifications/fetch",
  async (params: { unreadOnly?: boolean } | void, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<NotificationsResponse>("/api/admin/notifications", {
        params: params && params.unreadOnly ? { unread: 1 } : undefined,
      });
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message ?? "No se pudieron cargar las notificaciones");
    }
  },
  {
    // Polling + focus can overlap; skip while a request is in flight
    condition: (_, { getState }) => !(getState() as RootState).notifications.loading,
  },
);

export const markNotificationRead = createAsyncThunk(
  "notifications/markRead",
  async (id: number, { rejectWithValue }) => {
    try {
      await axios.post(`/api/admin/notifications/${id}/read`);
      return id;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message ?? "Error");
    }
  },
);

export const markAllNotificationsRead = createAsyncThunk(
  "notifications/markAllRead",
  async (_: void, { rejectWithValue }) => {
    try {
      await axios.post("/api/admin/notifications/read-all");
      return true;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message ?? "Error");
    }
  },
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchNotifications.pending, (s) => {
      s.loading = true;
    })
      .addCase(fetchNotifications.fulfilled, (s, a) => {
        s.loading = false;
        s.error = null;
        s.items = a.payload.items;
        s.unreadCount = a.payload.unread_count;
        s.lastFetchedAt = Date.now();
      })
      .addCase(fetchNotifications.rejected, (s, a) => {
        s.loading = false;
        s.error = (a.payload as string) ?? "Error";
      })
      // Optimistic: reflect read state immediately
      .addCase(markNotificationRead.pending, (s, a) => {
        const n = s.items.find((i) => i.id === a.meta.arg);
        if (n && !n.read_at) {
          n.read_at = new Date().toISOString();
          s.unreadCount = Math.max(0, s.unreadCount - 1);
        }
      })
      .addCase(markAllNotificationsRead.pending, (s) => {
        const now = new Date().toISOString();
        s.items.forEach((i) => {
          if (!i.read_at) i.read_at = now;
        });
        s.unreadCount = 0;
      });
  },
});

export const selectNotifications = (s: RootState) => s.notifications.items;
export const selectUnreadCount = (s: RootState) => s.notifications.unreadCount;
export const selectNotificationsLoading = (s: RootState) => s.notifications.loading;

export default notificationsSlice.reducer;
