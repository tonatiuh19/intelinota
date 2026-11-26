import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { ArticlesResponse } from "@shared/api";
import type { BookmarksState } from "../types";

const initialState: BookmarksState = { items: [], loading: false, error: null, loadedKey: null };

/** Loads saved articles by slug (max 100, chunked by the API's 50 limit). */
export const fetchBookmarkedArticles = createAsyncThunk(
  "bookmarks/fetch",
  async (slugs: string[], { rejectWithValue }) => {
    try {
      const chunks: string[][] = [];
      for (let i = 0; i < slugs.length; i += 50) chunks.push(slugs.slice(i, i + 50));
      const pages = await Promise.all(
        chunks.map((c) =>
          axios.get<ArticlesResponse>("/api/articles", { params: { slugs: c.join(","), limit: 50 } }),
        ),
      );
      return pages.flatMap((p) => p.data.data);
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "No se pudieron cargar tus guardados");
    }
  },
  {
    condition: (slugs, { getState }) => {
      const s = (getState() as { bookmarks: BookmarksState }).bookmarks;
      return slugs.length > 0 && s.loadedKey !== [...slugs].sort().join(",");
    },
  },
);

const bookmarksSlice = createSlice({
  name: "bookmarks",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchBookmarkedArticles.pending, (s) => {
      s.loading = true;
      s.error = null;
    })
      .addCase(fetchBookmarkedArticles.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload;
        s.loadedKey = [...a.meta.arg].sort().join(",");
      })
      .addCase(fetchBookmarkedArticles.rejected, (s, a) => {
        s.loading = false;
        s.error = (a.payload as string) ?? "Error";
      });
  },
});

export default bookmarksSlice.reducer;
