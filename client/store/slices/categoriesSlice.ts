import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Category, CategoriesResponse } from "@shared/api";
import type { RootState, CategoriesState } from "../types";
import { fetchHome } from "./homeSlice";

export type { CategoriesState };

const initialState: CategoriesState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchCategories = createAsyncThunk(
  "categories/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<CategoriesResponse>("/api/categories");
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch categories",
      );
    }
  },
);

const categoriesSlice = createSlice({
  name: "categories",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Populate from the home endpoint so the Navbar has categories
      // on every page without a dedicated /api/categories call.
      .addCase(fetchHome.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.categories;
      });
  },
});

export default categoriesSlice.reducer;

// ── Selectors ────────────────────────────────────────────────

export const selectCategories = (s: RootState) => s.categories.items;
export const selectCategoriesLoading = (s: RootState) => s.categories.loading;
export const selectCategoryBySlug = (slug: string) => (s: RootState) =>
  s.categories.items.find((c) => c.slug === slug);
