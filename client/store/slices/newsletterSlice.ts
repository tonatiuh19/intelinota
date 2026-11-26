import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type {
  NewsletterSubscribePayload,
  NewsletterSubscribeResponse,
} from "@shared/api";
import type { NewsletterState } from "../types";

const initialState: NewsletterState = {
  status: "idle",
  message: null,
  error: null,
  source: null,
};

export const subscribeNewsletter = createAsyncThunk(
  "newsletter/subscribe",
  async (payload: NewsletterSubscribePayload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post<NewsletterSubscribeResponse>(
        "/api/newsletter/subscribe",
        payload,
      );
      return data.data.message;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Inténtalo de nuevo en unos momentos.",
      );
    }
  },
);

export const unsubscribeNewsletter = createAsyncThunk(
  "newsletter/unsubscribe",
  async (token: string, { rejectWithValue }) => {
    try {
      await axios.post("/api/newsletter/unsubscribe", { token });
      return true;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "No se pudo procesar");
    }
  },
);

const newsletterSlice = createSlice({
  name: "newsletter",
  initialState,
  reducers: {
    resetNewsletter() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(subscribeNewsletter.pending, (state, action) => {
        state.source = action.meta.arg.source ?? null;
        state.status = "submitting";
        state.error = null;
      })
      .addCase(subscribeNewsletter.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.message = action.payload;
      })
      .addCase(unsubscribeNewsletter.pending, (state) => {
        state.source = "unsubscribe";
        state.status = "submitting";
        state.error = null;
      })
      .addCase(unsubscribeNewsletter.fulfilled, (state) => {
        state.status = "succeeded";
      })
      .addCase(unsubscribeNewsletter.rejected, (state, action) => {
        state.status = "failed";
        state.error = (action.payload as string) ?? "Error";
      })
      .addCase(subscribeNewsletter.rejected, (state, action) => {
        state.status = "failed";
        state.error = (action.payload as string) ?? "Error";
      });
  },
});

export const { resetNewsletter } = newsletterSlice.actions;
export default newsletterSlice.reducer;
