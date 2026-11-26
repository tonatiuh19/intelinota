import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { TagPageResponse } from "@shared/api";
import type { TagsState } from "../types";

const initialState: TagsState = { current: null, loading: false, error: null };

export const fetchTag = createAsyncThunk(
  "tags/fetch",
  async (slug: string, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<TagPageResponse>(`/api/tags/${encodeURIComponent(slug)}`);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "Tema no encontrado");
    }
  },
);

const tagsSlice = createSlice({
  name: "tags",
  initialState,
  reducers: {
    clearTag() {
      return initialState;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchTag.pending, (s) => {
      s.loading = true;
      s.error = null;
    })
      .addCase(fetchTag.fulfilled, (s, a) => {
        s.loading = false;
        s.current = a.payload;
      })
      .addCase(fetchTag.rejected, (s, a) => {
        s.loading = false;
        s.error = (a.payload as string) ?? "Error";
      });
  },
});

export const { clearTag } = tagsSlice.actions;
export default tagsSlice.reducer;
