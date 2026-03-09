import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { AdminAuthorsResponse, UpsertAuthorPayload } from "@shared/api";
import type { AdminAuthorsState, RootState } from "../types";

const initialState: AdminAuthorsState = {
  items: [],
  loading: false,
  error: null,
  saving: false,
  saveError: null,
};

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

export const fetchAdminAuthors = createAsyncThunk(
  "adminAuthors/fetchList",
  async (_, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<AdminAuthorsResponse>(
        "/api/admin/authors",
        { headers: authHeader(token) },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch authors",
      );
    }
  },
);

export const createAdminAuthor = createAsyncThunk(
  "adminAuthors/create",
  async (payload: UpsertAuthorPayload, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.post<{
        success: true;
        data: { id: number };
      }>("/api/admin/authors", payload, { headers: authHeader(token) });
      return data.data.id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to create author",
      );
    }
  },
);

export const updateAdminAuthor = createAsyncThunk(
  "adminAuthors/update",
  async (
    { id, payload }: { id: number; payload: Partial<UpsertAuthorPayload> },
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.put(`/api/admin/authors/${id}`, payload, {
        headers: authHeader(token),
      });
      return id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to update author",
      );
    }
  },
);

export const deleteAdminAuthor = createAsyncThunk(
  "adminAuthors/delete",
  async (id: number, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.delete(`/api/admin/authors/${id}`, {
        headers: authHeader(token),
      });
      return id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to delete author",
      );
    }
  },
);

const adminAuthorsSlice = createSlice({
  name: "adminAuthors",
  initialState,
  reducers: {
    clearSaveError(state) {
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminAuthors.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchAdminAuthors.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload;
      })
      .addCase(fetchAdminAuthors.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload as string;
      });

    builder
      .addCase(createAdminAuthor.pending, (s) => {
        s.saving = true;
        s.saveError = null;
      })
      .addCase(createAdminAuthor.fulfilled, (s) => {
        s.saving = false;
      })
      .addCase(createAdminAuthor.rejected, (s, a) => {
        s.saving = false;
        s.saveError = a.payload as string;
      });

    builder
      .addCase(updateAdminAuthor.pending, (s) => {
        s.saving = true;
        s.saveError = null;
      })
      .addCase(updateAdminAuthor.fulfilled, (s) => {
        s.saving = false;
      })
      .addCase(updateAdminAuthor.rejected, (s, a) => {
        s.saving = false;
        s.saveError = a.payload as string;
      });

    builder.addCase(deleteAdminAuthor.fulfilled, (s, a) => {
      s.items = s.items.filter((i) => i.id !== a.payload);
    });
  },
});

export const { clearSaveError } = adminAuthorsSlice.actions;

export const selectAdminAuthors = (s: RootState) => s.adminAuthors.items;
export const selectAdminAuthorsLoading = (s: RootState) =>
  s.adminAuthors.loading;
export const selectAdminAuthorsSaving = (s: RootState) => s.adminAuthors.saving;
export const selectAdminAuthorsSaveError = (s: RootState) =>
  s.adminAuthors.saveError;

export default adminAuthorsSlice.reducer;
