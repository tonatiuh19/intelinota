import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { AdminSettingsResponse } from "@shared/api";
import type { AdminSettingsState, RootState } from "../types";

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const initialState: AdminSettingsState = {
  items: [],
  loading: false,
  error: null,
  saving: false,
  saveError: null,
};

export const fetchAdminSettings = createAsyncThunk(
  "adminSettings/fetch",
  async (_, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<AdminSettingsResponse>(
        "/api/admin/settings",
        { headers: authHeader(token) },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch settings",
      );
    }
  },
);

export const updateAdminSettings = createAsyncThunk(
  "adminSettings/update",
  async (
    settings: Array<{ key: string; value: string }>,
    { getState, rejectWithValue, dispatch },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.put(
        "/api/admin/settings",
        { settings },
        { headers: authHeader(token) },
      );
      dispatch(fetchAdminSettings());
      return true;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to update settings",
      );
    }
  },
);

const adminSettingsSlice = createSlice({
  name: "adminSettings",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminSettings.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchAdminSettings.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload;
      })
      .addCase(fetchAdminSettings.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload as string;
      })
      .addCase(updateAdminSettings.pending, (s) => {
        s.saving = true;
        s.saveError = null;
      })
      .addCase(updateAdminSettings.fulfilled, (s) => {
        s.saving = false;
      })
      .addCase(updateAdminSettings.rejected, (s, a) => {
        s.saving = false;
        s.saveError = a.payload as string;
      });
  },
});

export default adminSettingsSlice.reducer;

export const selectAdminSettings = (s: RootState) => s.adminSettings.items;
export const selectAdminSettingsLoading = (s: RootState) =>
  s.adminSettings.loading;
export const selectAdminSettingsSaving = (s: RootState) =>
  s.adminSettings.saving;
export const selectAdminSettingsSaveError = (s: RootState) =>
  s.adminSettings.saveError;
export const selectAdminAppVersion = (s: RootState) =>
  s.adminSettings.items.find((i) => i.setting_key === "app_version")
    ?.setting_value ?? null;
