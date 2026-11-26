import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import type { AdminCategory, ApiSuccess, CategoryWritePayload } from "@shared/api";
import type { AdminCategoriesState, RootState } from "../types";
import { fetchHome, invalidateHome } from "./homeSlice";
import { fetchCategories } from "./categoriesSlice";

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const initialState: AdminCategoriesState = {
  items: [],
  loading: false,
  error: null,
  saving: false,
  saveError: null,
};

const errMsg = (err: any, fallback: string): string => err?.response?.data?.message ?? fallback;

type ThunkApi = { getState: () => unknown; rejectWithValue: (v: string) => any; dispatch: any };

function tokenOf(getState: () => unknown): string | null {
  return (getState() as RootState).adminAuth.token;
}

/** Refetch admin list + public caches (nav/home/categories) after a change. */
function invalidate(dispatch: any) {
  dispatch(fetchAdminCategories());
  dispatch(invalidateHome());
  dispatch(fetchHome());
  dispatch(fetchCategories());
}

async function mutate<T>(
  api: ThunkApi,
  fallback: string,
  run: (headers: Record<string, string>) => Promise<T>,
): Promise<T> {
  const token = tokenOf(api.getState);
  if (!token) return api.rejectWithValue("Not authenticated");
  try {
    const out = await run(authHeader(token));
    invalidate(api.dispatch);
    return out;
  } catch (err) {
    return api.rejectWithValue(errMsg(err, fallback));
  }
}

export const fetchAdminCategories = createAsyncThunk(
  "adminCategories/fetch",
  async (_, { getState, rejectWithValue }) => {
    const token = tokenOf(getState);
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<ApiSuccess<AdminCategory[]>>("/api/admin/categories", { headers: authHeader(token) });
      return data.data;
    } catch (err) {
      return rejectWithValue(errMsg(err, "No se pudieron cargar las secciones"));
    }
  },
);

export const checkCategorySlug = createAsyncThunk(
  "adminCategories/checkSlug",
  async ({ slug, excludeId }: { slug: string; excludeId?: number }, { getState, rejectWithValue }) => {
    const token = tokenOf(getState);
    if (!token) return rejectWithValue("Not authenticated");
    try {
      const { data } = await axios.get<ApiSuccess<{ slug: string; available: boolean }>>(
        "/api/admin/categories/slug-available",
        { params: { slug, exclude_id: excludeId }, headers: authHeader(token) },
      );
      return data.data;
    } catch (err) {
      return rejectWithValue(errMsg(err, "No se pudo verificar el slug"));
    }
  },
);

export const createAdminCategory = createAsyncThunk(
  "adminCategories/create",
  (payload: CategoryWritePayload, api) =>
    mutate(api, "No se pudo crear la sección", async (headers) => {
      const { data } = await axios.post<ApiSuccess<{ id: number; slug: string }>>("/api/admin/categories", payload, { headers });
      return data.data;
    }),
);

export const updateAdminCategory = createAsyncThunk(
  "adminCategories/update",
  ({ id, payload }: { id: number; payload: Partial<CategoryWritePayload & { sort_order: number }> }, api) =>
    mutate(api, "No se pudo guardar la sección", async (headers) => {
      await axios.put(`/api/admin/categories/${id}`, payload, { headers });
      return id;
    }),
);

export const deleteAdminCategory = createAsyncThunk(
  "adminCategories/delete",
  ({ id, moveTo }: { id: number; moveTo?: number }, api) =>
    mutate(api, "No se pudo eliminar la sección", async (headers) => {
      const { data } = await axios.delete<ApiSuccess<{ id: number; moved: number }>>(`/api/admin/categories/${id}`, {
        params: moveTo ? { move_to: moveTo } : undefined,
        headers,
      });
      return data.data;
    }),
);

export const reorderAdminCategories = createAsyncThunk(
  "adminCategories/reorder",
  (ids: number[], api) =>
    mutate(api, "No se pudo guardar el orden", async (headers) => {
      await axios.patch("/api/admin/categories/reorder", { ids }, { headers });
      return ids;
    }),
);

export const createAdminSubcategory = createAsyncThunk(
  "adminCategories/createSub",
  ({ categoryId, name, slug }: { categoryId: number; name: string; slug: string }, api) =>
    mutate(api, "No se pudo crear la subsección", async (headers) => {
      const { data } = await axios.post<ApiSuccess<{ id: number }>>(`/api/admin/categories/${categoryId}/subcategories`, { name, slug }, { headers });
      return data.data;
    }),
);

export const updateAdminSubcategory = createAsyncThunk(
  "adminCategories/updateSub",
  ({ id, name, slug }: { id: number; name?: string; slug?: string }, api) =>
    mutate(api, "No se pudo renombrar la subsección", async (headers) => {
      await axios.put(`/api/admin/subcategories/${id}`, { name, slug }, { headers });
      return id;
    }),
);

export const deleteAdminSubcategory = createAsyncThunk(
  "adminCategories/deleteSub",
  ({ id, moveTo }: { id: number; moveTo?: number | "none" }, api) =>
    mutate(api, "No se pudo eliminar la subsección", async (headers) => {
      await axios.delete(`/api/admin/subcategories/${id}`, { params: moveTo ? { move_to: moveTo } : undefined, headers });
      return id;
    }),
);

export const reorderAdminSubcategories = createAsyncThunk(
  "adminCategories/reorderSubs",
  ({ categoryId, ids }: { categoryId: number; ids: number[] }, api) =>
    mutate(api, "No se pudo guardar el orden", async (headers) => {
      await axios.patch(`/api/admin/categories/${categoryId}/subcategories/reorder`, { ids }, { headers });
      return { categoryId, ids };
    }),
);

const adminCategoriesSlice = createSlice({
  name: "adminCategories",
  initialState,
  reducers: {
    clearCategorySaveError(state) {
      state.saveError = null;
    },
    /** Optimistic local order (applied while dragging / before save). */
    setLocalCategoryOrder(state, action: PayloadAction<number[]>) {
      const byId = new Map(state.items.map((c) => [c.id, c]));
      state.items = action.payload.map((id) => byId.get(id)).filter((c): c is AdminCategory => !!c);
    },
    setLocalSubcategoryOrder(state, action: PayloadAction<{ categoryId: number; ids: number[] }>) {
      const cat = state.items.find((c) => c.id === action.payload.categoryId);
      if (!cat) return;
      const byId = new Map(cat.subcategories.map((s) => [s.id, s]));
      cat.subcategories = action.payload.ids.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
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
        if (a.meta.aborted) return;
        s.error = a.payload as string;
      });
    const writes = [
      createAdminCategory,
      updateAdminCategory,
      deleteAdminCategory,
      reorderAdminCategories,
      createAdminSubcategory,
      updateAdminSubcategory,
      deleteAdminSubcategory,
      reorderAdminSubcategories,
    ] as const;
    for (const t of writes) {
      builder
        .addCase(t.pending, (s) => {
          s.saving = true;
          s.saveError = null;
        })
        .addCase(t.fulfilled, (s) => {
          s.saving = false;
        })
        .addCase(t.rejected, (s, a) => {
          s.saving = false;
          s.saveError = (a.payload as string) ?? "Error";
        });
    }
  },
});

export const { clearCategorySaveError, setLocalCategoryOrder, setLocalSubcategoryOrder } = adminCategoriesSlice.actions;
export default adminCategoriesSlice.reducer;

export const selectAdminCategories = (s: RootState) => s.adminCategories.items;
export const selectAdminCategoriesLoading = (s: RootState) => s.adminCategories.loading;
export const selectAdminCategoriesSaving = (s: RootState) => s.adminCategories.saving;
export const selectAdminCategoriesSaveError = (s: RootState) => s.adminCategories.saveError;
