import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { SearchParams, SearchResponse } from "@shared/api";
import type { SearchPageState } from "../types";

export const PAGE_SIZE = 12;

const initialState: SearchPageState = {
  params: null,
  results: [],
  total: 0,
  totalPages: 0,
  facets: { categories: [], authors: [] },
  loading: false,
  error: null,
  tookMs: null,
};

/** Full-page search with facets. Latest request wins (requestId check). */
export const runSearch = createAsyncThunk(
  "searchPage/run",
  async (params: SearchParams, { rejectWithValue, signal }) => {
    const started = performance.now();
    try {
      const { data } = await axios.get<SearchResponse>("/api/articles", {
        signal,
        params: {
          search: params.q || undefined,
          category: params.category,
          author: params.author,
          since: params.since,
          read: params.read,
          sort: params.sort,
          page: params.page ?? 1,
          limit: PAGE_SIZE,
          facets: 1,
        },
      });
      return { data, tookMs: Math.round(performance.now() - started) };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "No se pudo completar la búsqueda");
    }
  },
);

let latestRequest = "";

const searchPageSlice = createSlice({
  name: "searchPage",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(runSearch.pending, (s, a) => {
      latestRequest = a.meta.requestId;
      s.loading = true;
      s.error = null;
      s.params = a.meta.arg;
    })
      .addCase(runSearch.fulfilled, (s, a) => {
        if (a.meta.requestId !== latestRequest) return;
        const { data, tookMs } = a.payload;
        s.loading = false;
        s.results = data.data;
        s.total = data.pagination.total;
        s.totalPages = data.pagination.totalPages;
        s.facets = data.facets ?? { categories: [], authors: [] };
        s.tookMs = tookMs;
      })
      .addCase(runSearch.rejected, (s, a) => {
        if (a.meta.aborted || a.meta.requestId !== latestRequest) return;
        s.loading = false;
        s.error = (a.payload as string) ?? "Error";
      });
  },
});

export default searchPageSlice.reducer;
