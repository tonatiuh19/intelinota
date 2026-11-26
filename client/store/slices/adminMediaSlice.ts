import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "@/lib/apiClient";
import type { AdminUploadResponse } from "@shared/api";
import type { AdminMediaState } from "../types";

const initialState: AdminMediaState = {
  uploading: 0,
  lastUrl: null,
  error: null,
};

export interface UploadMediaArgs {
  data_base64: string;
  filename: string;
  mime_type: string;
  alt_text?: string;
  /** Optional upload progress callback (0–100). Not sent to the API. */
  onProgress?: (percent: number) => void;
}

export const uploadMedia = createAsyncThunk(
  "adminMedia/upload",
  async ({ onProgress, ...body }: UploadMediaArgs, { rejectWithValue }) => {
    try {
      const { data } = await axios.post<AdminUploadResponse>(
        "/api/admin/upload",
        body,
        {
          onUploadProgress: onProgress
            ? (e) => {
                if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
              }
            : undefined,
        },
      );
      if (!data.success || !data.data?.url) {
        return rejectWithValue("Upload failed");
      }
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err?.response?.data?.message ?? err?.message ?? "Upload error",
      );
    }
  },
);

const adminMediaSlice = createSlice({
  name: "adminMedia",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(uploadMedia.pending, (state) => {
        state.uploading += 1;
        state.error = null;
      })
      .addCase(uploadMedia.fulfilled, (state, action) => {
        state.uploading = Math.max(0, state.uploading - 1);
        state.lastUrl = action.payload.url;
      })
      .addCase(uploadMedia.rejected, (state, action) => {
        state.uploading = Math.max(0, state.uploading - 1);
        state.error = (action.payload as string) ?? "Upload error";
      });
  },
});

export default adminMediaSlice.reducer;
