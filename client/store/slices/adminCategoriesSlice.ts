import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Category } from "@shared/api";
import type { AdminCategoriesState, RootState } from "../types";

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const initialState: AdminCategoriesState = {
  items: [],
  loading: false,
  error: null,
  saving: false,
  saveError: null,
};

export const fetchAdminCategories = createAsyncThunk(
  "adminCategories/fetch",
  async (_, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<{ success: true; data: Category[] }>(
        "/api/admin/categories",
        { headers: authHeader(token) },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch categories",
      );
    }
  },
);

export const updateAdminCategory = createAsyncThunk(
  "adminCategories/update",
  async (
    {
      id,
      payload,
    }: {
      id: number;
      payload: Partial<{
        name: string;
        slug: string;
        description: string;
        is_active: boolean;
        sort_order: number;
      }>;
    },
    { getState, rejectWithValue, dispatch },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.put(`/api/admin/categories/${id}`, payload, {
        headers: authHeader(token),
      });
      dispatch(fetchAdminCategories());
      return id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to update category",
      );
    }
  },
);

const adminCategoriesSlice = createSlice({
  name: "adminCategories",
  initialState,
  reducers: {
    clearCategorySaveError(state) {
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminCategories.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchAdminCategories.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload;
      })
      .addCase(fetchAdminCategories.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload as string;
      })
      .addCase(updateAdminCategory.pending, (s) => {
        s.saving = true;
        s.saveError = null;
      })
      .addCase(updateAdminCategory.fulfilled, (s) => {
        s.saving = false;
      })
      .addCase(updateAdminCategory.rejected, (s, a) => {
        s.saving = false;
        s.saveError = a.payload as string;
      });
  },
});

export const { clearCategorySaveError } = adminCategoriesSlice.actions;
export default adminCategoriesSlice.reducer;

export const selectAdminCategories = (s: RootState) => s.adminCategories.items;
export const selectAdminCategoriesLoading = (s: RootState) =>
  s.adminCategories.loading;
export const selectAdminCategoriesSaving = (s: RootState) =>
  s.adminCategories.saving;
export const selectAdminCategoriesSaveError = (s: RootState) =>
  s.adminCategories.saveError;
