import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import type { ArticlesResponse } from "@shared/api";
import type { SearchState } from "../types";

const RECENT_KEY = "intelinota_recent_searches";

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const initialState: SearchState = {
  query: "",
  results: [],
  loading: false,
  error: null,
  recent: typeof window === "undefined" ? [] : readRecent(),
};

/** Instant search (overlay). Latest request wins via requestId check. */
export const instantSearch = createAsyncThunk(
  "search/instant",
  async (query: string, { rejectWithValue, signal }) => {
    try {
      const { data } = await axios.get<ArticlesResponse>("/api/articles", {
        params: { search: query, limit: 8 },
        signal,
      });
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "Error de búsqueda");
    }
  },
);

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
      if (!action.payload.trim()) {
        state.results = [];
        state.loading = false;
      }
    },
    addRecent(state, action: PayloadAction<string>) {
      const q = action.payload.trim();
      if (!q) return;
      state.recent = [q, ...state.recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6);
      writeRecent(state.recent);
    },
    clearRecent(state) {
      state.recent = [];
      writeRecent([]);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(instantSearch.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(instantSearch.fulfilled, (state, action) => {
        if (action.meta.arg !== state.query.trim()) return;
        state.loading = false;
        state.results = action.payload;
      })
      .addCase(instantSearch.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.loading = false;
        state.error = (action.payload as string) ?? "Error";
      });
  },
});

export const { setQuery, addRecent, clearRecent } = searchSlice.actions;
export default searchSlice.reducer;
