import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { AuthorsResponse, AuthorResponse } from "@shared/api";
import type { AuthorsState, RootState } from "../types";
import { parseSocialLinks } from "@/lib/socialLinks";

const initialState: AuthorsState = {
  list: [],
  listLoading: false,
  listError: null,
  current: null,
  loading: false,
  error: null,
  currentSlug: null,
};

export const fetchAuthorsList = createAsyncThunk(
  "authors/fetchList",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<AuthorsResponse>("/api/authors");
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch authors",
      );
    }
  },
  {
    condition: (_, { getState }) => {
      const s = (getState() as RootState).authors;
      return !s.listLoading && s.list.length === 0;
    },
  },
);

export const fetchAuthor = createAsyncThunk(
  "authors/fetchOne",
  async (slug: string, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<AuthorResponse>(
        `/api/authors/${slug}`,
      );
      return { slug, author: data.data };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Author not found",
      );
    }
  },
  {
    condition: (slug, { getState }) => {
      const s = (getState() as RootState).authors;
      if (s.loading) return false;
      if (s.currentSlug === slug && s.current) return false;
      return true;
    },
  },
);

const authorsSlice = createSlice({
  name: "authors",
  initialState,
  reducers: {
    clearAuthor(state) {
      state.current = null;
      state.error = null;
      state.currentSlug = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuthorsList.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchAuthorsList.fulfilled, (state, action) => {
        state.listLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchAuthorsList.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload as string;
      })
      .addCase(fetchAuthor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAuthor.fulfilled, (state, action) => {
        state.loading = false;
        state.current = {
          ...action.payload.author,
          social_links: parseSocialLinks(action.payload.author.social_links),
        };
        state.currentSlug = action.payload.slug;
      })
      .addCase(fetchAuthor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.current = null;
      });
  },
});

export const { clearAuthor } = authorsSlice.actions;
export default authorsSlice.reducer;

export const selectAuthor = (s: RootState) => s.authors.current;
export const selectAuthorLoading = (s: RootState) => s.authors.loading;
export const selectAuthorError = (s: RootState) => s.authors.error;
export const selectAuthorsList = (s: RootState) => s.authors.list;
export const selectAuthorsListLoading = (s: RootState) => s.authors.listLoading;
export const selectAuthorsListError = (s: RootState) => s.authors.listError;
