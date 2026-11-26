import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type {
  AdminAuthorsResponse,
  AuthorAccessPayload,
  AuthorAccessResponse,
  AuthorSlugAvailabilityResponse,
  UpsertAuthorPayload,
} from "@shared/api";
import type { AdminAuthorsState, RootState } from "../types";

const initialState: AdminAuthorsState = {
  items: [],
  loading: false,
  error: null,
  saving: false,
  saveError: null,
  deleteError: null,
  slugCheck: { slug: "", checking: false, available: null, suggestion: "" },
  accessBusyId: null,
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
        data: {
          id: number;
          access: AuthorAccessResponse["data"] | null;
          access_error: string | null;
        };
      }>("/api/admin/authors", payload, { headers: authHeader(token) });
      return data.data;
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

/** Trusted-author toggle (admin only). Optimistic; reverted on failure. */
export const setAuthorCanPublish = createAsyncThunk(
  "adminAuthors/setCanPublish",
  async (
    { id, can_publish }: { id: number; can_publish: boolean },
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.put(`/api/admin/authors/${id}`, { can_publish }, {
        headers: authHeader(token),
      });
      return { id, can_publish };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "No se pudo actualizar el permiso",
      );
    }
  },
);

export const deleteAdminAuthor = createAsyncThunk(
  "adminAuthors/delete",
  async (
    { id, reassignTo }: { id: number; reassignTo?: number | null },
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.delete(`/api/admin/authors/${id}`, {
        headers: authHeader(token),
        params: reassignTo ? { reassign_to: reassignTo } : undefined,
      });
      return id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to delete author",
      );
    }
  },
);

/** Debounced in the form; latest request wins (stale responses ignored). */
export const checkAuthorSlug = createAsyncThunk(
  "adminAuthors/checkSlug",
  async (
    { slug, excludeId }: { slug: string; excludeId?: number | null },
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<AuthorSlugAvailabilityResponse>(
        "/api/admin/authors/slug-available",
        {
          headers: authHeader(token),
          params: { slug, exclude_id: excludeId ?? undefined },
        },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "No se pudo verificar el slug",
      );
    }
  },
);

/** Invite/link a panel account to an author (creates the user if missing). */
export const grantAuthorAccess = createAsyncThunk(
  "adminAuthors/grantAccess",
  async (
    { id, payload }: { id: number; payload: AuthorAccessPayload },
    { getState, rejectWithValue },
  ) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.post<AuthorAccessResponse>(
        `/api/admin/authors/${id}/access`,
        payload,
        { headers: authHeader(token) },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "No se pudo dar acceso",
      );
    }
  },
);

/** Unlink the panel account (the user row is kept, demoted to reader). */
export const revokeAuthorAccess = createAsyncThunk(
  "adminAuthors/revokeAccess",
  async (id: number, { getState, rejectWithValue }) => {
    const token = (getState() as RootState).adminAuth.token;
    if (!token) return rejectWithValue("Not authenticated");
    try {
      await axios.delete(`/api/admin/authors/${id}/access`, {
        headers: authHeader(token),
      });
      return id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "No se pudo quitar el acceso",
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
    resetSlugCheck(state) {
      state.slugCheck = { slug: "", checking: false, available: null, suggestion: "" };
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

    builder
      .addCase(setAuthorCanPublish.pending, (s, a) => {
        const item = s.items.find((i) => i.id === a.meta.arg.id);
        if (item) item.can_publish = a.meta.arg.can_publish;
        s.saveError = null;
      })
      .addCase(setAuthorCanPublish.rejected, (s, a) => {
        const item = s.items.find((i) => i.id === a.meta.arg.id);
        if (item) item.can_publish = !a.meta.arg.can_publish;
        s.saveError = a.payload as string;
      });

    builder
      .addCase(checkAuthorSlug.pending, (s, a) => {
        s.slugCheck = { slug: a.meta.arg.slug, checking: true, available: null, suggestion: "" };
      })
      .addCase(checkAuthorSlug.fulfilled, (s, a) => {
        if (s.slugCheck.slug !== a.meta.arg.slug) return;
        s.slugCheck = { slug: a.meta.arg.slug, checking: false, ...a.payload };
      })
      .addCase(checkAuthorSlug.rejected, (s, a) => {
        if (s.slugCheck.slug !== a.meta.arg.slug) return;
        s.slugCheck.checking = false;
      });

    builder
      .addCase(grantAuthorAccess.pending, (s, a) => {
        s.accessBusyId = a.meta.arg.id;
      })
      .addCase(grantAuthorAccess.fulfilled, (s, a) => {
        s.accessBusyId = null;
        const item = s.items.find((i) => i.id === a.meta.arg.id);
        if (item) {
          item.user_id = a.payload.user_id;
          item.user_email = a.meta.arg.payload.email.toLowerCase().trim();
          item.user_role = a.meta.arg.payload.role;
          item.can_publish = a.meta.arg.payload.role === "admin" || a.meta.arg.payload.can_publish;
        }
      })
      .addCase(grantAuthorAccess.rejected, (s) => {
        s.accessBusyId = null;
      })
      .addCase(revokeAuthorAccess.pending, (s, a) => {
        s.accessBusyId = a.meta.arg;
      })
      .addCase(revokeAuthorAccess.fulfilled, (s, a) => {
        s.accessBusyId = null;
        const item = s.items.find((i) => i.id === a.payload);
        if (item) {
          item.user_id = null;
          item.user_email = null;
          item.user_role = null;
          item.can_publish = false;
        }
      })
      .addCase(revokeAuthorAccess.rejected, (s) => {
        s.accessBusyId = null;
      });

    builder.addCase(deleteAdminAuthor.pending, (s) => {
      s.deleteError = null;
    });
    builder.addCase(deleteAdminAuthor.fulfilled, (s, a) => {
      s.items = s.items.filter((i) => i.id !== a.payload);
      s.deleteError = null;
    });
    builder.addCase(deleteAdminAuthor.rejected, (s, a) => {
      s.deleteError = a.payload as string;
    });
  },
});

export const { clearSaveError, resetSlugCheck } = adminAuthorsSlice.actions;

export const selectAdminAuthors = (s: RootState) => s.adminAuthors.items;
export const selectAdminAuthorsLoading = (s: RootState) =>
  s.adminAuthors.loading;
export const selectAdminAuthorsError = (s: RootState) => s.adminAuthors.error;
export const selectAdminAuthorsSaving = (s: RootState) => s.adminAuthors.saving;
export const selectAdminAuthorsSaveError = (s: RootState) =>
  s.adminAuthors.saveError;
export const selectAdminAuthorsDeleteError = (s: RootState) =>
  s.adminAuthors.deleteError;

export default adminAuthorsSlice.reducer;
