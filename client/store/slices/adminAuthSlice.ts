import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type {
  AuthRequestCodeResponse,
  AuthVerifyCodeResponse,
  RequestCodePayload,
  VerifyCodePayload,
} from "@shared/api";
import type { AdminAuthState, RootState } from "../types";

const TOKEN_KEY = "intelinota_admin_token";

const initialState: AdminAuthState = {
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  loading: false,
  error: null,
  codeSent: false,
  codeSentEmail: null,
};

export const requestAdminCode = createAsyncThunk(
  "adminAuth/requestCode",
  async (payload: RequestCodePayload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post<AuthRequestCodeResponse>(
        "/api/admin/auth/request-code",
        payload,
      );
      return { email: payload.email, message: data.data.message };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to send code",
      );
    }
  },
);

export const verifyAdminCode = createAsyncThunk(
  "adminAuth/verifyCode",
  async (payload: VerifyCodePayload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post<AuthVerifyCodeResponse>(
        "/api/admin/auth/verify-code",
        payload,
      );
      localStorage.setItem(TOKEN_KEY, data.data.token);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message ?? "Invalid or expired code",
      );
    }
  },
);

export const fetchAdminMe = createAsyncThunk(
  "adminAuth/me",
  async (_, { getState, rejectWithValue }) => {
    const { token } = (getState() as RootState).adminAuth;
    if (!token) return rejectWithValue("No token");
    try {
      const { data } = await axios.get("/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message ?? "Session expired");
    }
  },
);

const adminAuthSlice = createSlice({
  name: "adminAuth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      state.codeSent = false;
      state.codeSentEmail = null;
      state.error = null;
      localStorage.removeItem(TOKEN_KEY);
    },
    clearError(state) {
      state.error = null;
    },
    resetCodeSent(state) {
      state.codeSent = false;
      state.codeSentEmail = null;
    },
  },
  extraReducers: (builder) => {
    // requestAdminCode
    builder
      .addCase(requestAdminCode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(requestAdminCode.fulfilled, (state, action) => {
        state.loading = false;
        state.codeSent = true;
        state.codeSentEmail = action.payload.email;
      })
      .addCase(requestAdminCode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // verifyAdminCode
    builder
      .addCase(verifyAdminCode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyAdminCode.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.codeSent = false;
        state.codeSentEmail = null;
      })
      .addCase(verifyAdminCode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // fetchAdminMe
    builder
      .addCase(fetchAdminMe.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(fetchAdminMe.rejected, (state) => {
        state.user = null;
        state.token = null;
        localStorage.removeItem(TOKEN_KEY);
      });
  },
});

export const { logout, clearError, resetCodeSent } = adminAuthSlice.actions;

export const selectAdminUser = (s: RootState) => s.adminAuth.user;
export const selectAdminToken = (s: RootState) => s.adminAuth.token;
export const selectAdminAuthLoading = (s: RootState) => s.adminAuth.loading;
export const selectAdminAuthError = (s: RootState) => s.adminAuth.error;
export const selectAdminCodeSent = (s: RootState) => s.adminAuth.codeSent;
export const selectAdminCodeSentEmail = (s: RootState) =>
  s.adminAuth.codeSentEmail;
export const selectIsAdminAuthenticated = (s: RootState) =>
  !!s.adminAuth.token && !!s.adminAuth.user;

export default adminAuthSlice.reducer;
