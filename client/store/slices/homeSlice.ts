import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { HomeResponse } from "@shared/api";
import type { RootState, HomeState } from "../types";

export type { HomeState };

const initialState: HomeState = {
  featured: [],
  trending: [],
  mostRead: [],
  articles: [],
  categories: [],
  meta: null,
  loading: false,
  loaded: false,
  error: null,
};

/**
 * Fetches all home page data in a single API call.
 * The `condition` option prevents duplicate fetches — if data is already
 * loaded or a request is in-flight, the thunk exits immediately.
 */
export const fetchHome = createAsyncThunk(
  "home/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<HomeResponse>("/api/home");
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to load home data",
      );
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as RootState;
      return !state.home.loaded && !state.home.loading;
    },
  },
);

const homeSlice = createSlice({
  name: "home",
  initialState,
  reducers: {
    /** Marks home data stale so the next fetchHome() refetches (e.g. after admin taxonomy edits). */
    invalidateHome(state) {
      state.loaded = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHome.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHome.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.featured = action.payload.featured;
        state.trending = action.payload.trending;
        state.mostRead = action.payload.mostRead ?? [];
        state.articles = action.payload.articles;
        state.categories = action.payload.categories;
        state.meta = action.payload.meta;
      })
      .addCase(fetchHome.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { invalidateHome } = homeSlice.actions;
export default homeSlice.reducer;

// ── Selectors ────────────────────────────────────────────────

export const selectHomeLoading = (s: RootState) => s.home.loading;
export const selectHomeLoaded = (s: RootState) => s.home.loaded;
export const selectHomeError = (s: RootState) => s.home.error;
export const selectHomeFeatured = (s: RootState) => s.home.featured;
export const selectHomeTrending = (s: RootState) => s.home.trending;
export const selectHomeMostRead = (s: RootState) => s.home.mostRead;
export const selectHomeArticles = (s: RootState) => s.home.articles;
export const selectHomeCategories = (s: RootState) => s.home.categories;
export const selectHomeMeta = (s: RootState) => s.home.meta;
