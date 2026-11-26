import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "@/lib/apiClient";

/** Payload the editor sends (single continuous HTML document). */
export interface EditorArticlePayload {
  title: string;
  slug: string;
  excerpt: string | null;
  category_id: number;
  subcategory_id: number | null;
  author_id: number;
  image_url: string | null;
  read_time_minutes: number;
  featured: boolean;
  trending: boolean;
  status: string;
  published_at: string | null;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  blocks: Array<{ position: number; type: "html"; data: { html: string } }>;
  expected_updated_at?: string | null;
}

export type SaveOutcome =
  | { kind: "saved"; id: number; updated_at: string | null }
  | { kind: "pending"; id: number }
  | { kind: "conflict"; updated_at: string | null };

export interface ArticleEditorState {
  saving: boolean;
  lastSavedAt: number | null;
  error: string | null;
  slugCheck: { slug: string; available: boolean; suggestion: string } | null;
}

const initialState: ArticleEditorState = { saving: false, lastSavedAt: null, error: null, slugCheck: null };

async function fetchUpdatedAt(id: number): Promise<string | null> {
  try {
    const { data } = await axios.get(`/api/admin/articles/${id}`);
    return data?.data?.updated_at ?? null;
  } catch {
    return null;
  }
}

/**
 * Create or update an article. Handles:
 *  - 202 → pending review (author editing a live article)
 *  - 409 → conflict (someone else saved since we loaded)
 */
export const saveArticle = createAsyncThunk<
  SaveOutcome,
  { id: number | null; payload: EditorArticlePayload; autosave?: boolean },
  { rejectValue: string }
>("articleEditor/save", async ({ id, payload }, { rejectWithValue }) => {
  try {
    if (id == null) {
      const { data } = await axios.post("/api/admin/articles", payload);
      const newId = data.data.id as number;
      return { kind: "saved", id: newId, updated_at: data.data.updated_at ?? (await fetchUpdatedAt(newId)) };
    }
    const res = await axios.put(`/api/admin/articles/${id}`, payload, {
      validateStatus: (s) => (s >= 200 && s < 300) || s === 409,
    });
    if (res.status === 409 && res.data?.code === "SLUG_TAKEN") return rejectWithValue("Esa URL ya está en uso. Cámbiala en Detalles.");
    if (res.status === 409) return { kind: "conflict", updated_at: res.data?.data?.updated_at ?? null };
    if (res.status === 202 || res.data?.data?.pending) return { kind: "pending", id };
    return { kind: "saved", id, updated_at: res.data?.data?.updated_at ?? (await fetchUpdatedAt(id)) };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message ?? (navigator.onLine ? "No se pudo guardar" : "Sin conexión"));
  }
});

export const checkSlug = createAsyncThunk(
  "articleEditor/checkSlug",
  async ({ slug, excludeId }: { slug: string; excludeId: number | null }) => {
    try {
      const { data } = await axios.get("/api/admin/articles/slug-available", {
        params: { slug, exclude_id: excludeId ?? undefined },
      });
      return { slug, available: Boolean(data.data.available), suggestion: String(data.data.suggestion ?? slug) };
    } catch {
      return { slug, available: true, suggestion: slug };
    }
  },
);

const articleEditorSlice = createSlice({
  name: "articleEditor",
  initialState,
  reducers: {
    resetEditor() {
      return initialState;
    },
  },
  extraReducers: (b) => {
    b.addCase(saveArticle.pending, (s) => {
      s.saving = true;
      s.error = null;
    })
      .addCase(saveArticle.fulfilled, (s, a) => {
        s.saving = false;
        if (a.payload.kind !== "conflict") s.lastSavedAt = Date.now();
      })
      .addCase(saveArticle.rejected, (s, a) => {
        s.saving = false;
        s.error = a.payload ?? "No se pudo guardar";
      })
      .addCase(checkSlug.fulfilled, (s, a) => {
        s.slugCheck = a.payload;
      });
  },
});

export const { resetEditor } = articleEditorSlice.actions;
export default articleEditorSlice.reducer;
