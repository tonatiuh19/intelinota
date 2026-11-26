import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "@/lib/apiClient";
import type {
  McpConnectionsData,
  McpConsentInfo,
  McpConsentRequest,
} from "@shared/api";
import type { AdminMcpState, RootState } from "../types";

const initialState: AdminMcpState = {
  consent: null,
  consentLoading: false,
  consentError: null,
  deciding: false,
  connectorUrl: null,
  connections: [],
  connectionsLoading: false,
  connectionsError: null,
  revokingId: null,
};

const msg = (err: any, fallback: string) =>
  err?.response?.data?.message ?? fallback;

/** Consent page: validates client + redirect and returns my rights summary. */
export const fetchMcpConsentInfo = createAsyncThunk(
  "adminMcp/fetchConsentInfo",
  async (q: { client_id: string; redirect_uri: string }, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<{ success: boolean; data: McpConsentInfo }>(
        "/api/admin/mcp/oauth/client",
        { params: q },
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(msg(err, "Solicitud de conexión inválida"));
    }
  },
);

/** Approve/deny → server returns the client redirect (with code or error). */
export const decideMcpConsent = createAsyncThunk(
  "adminMcp/decide",
  async (
    input: McpConsentRequest & { approve: boolean },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await axios.post<{ success: boolean; data: { redirect_to: string } }>(
        "/api/admin/mcp/oauth/approve",
        input,
      );
      return data.data.redirect_to;
    } catch (err: any) {
      return rejectWithValue(msg(err, "No se pudo completar la autorización"));
    }
  },
);

export const fetchMcpConnections = createAsyncThunk(
  "adminMcp/fetchConnections",
  async (_: void, { rejectWithValue }) => {
    try {
      const { data } = await axios.get<{ success: boolean; data: McpConnectionsData }>(
        "/api/admin/me/mcp-connections",
      );
      return data.data;
    } catch (err: any) {
      return rejectWithValue(msg(err, "No se pudieron cargar las conexiones"));
    }
  },
);

export const revokeMcpConnection = createAsyncThunk(
  "adminMcp/revoke",
  async (id: number, { rejectWithValue }) => {
    try {
      await axios.delete(`/api/admin/me/mcp-connections/${id}`);
      return id;
    } catch (err: any) {
      return rejectWithValue(msg(err, "No se pudo revocar la conexión"));
    }
  },
);

const adminMcpSlice = createSlice({
  name: "adminMcp",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchMcpConsentInfo.pending, (s) => {
      s.consentLoading = true;
      s.consentError = null;
    })
      .addCase(fetchMcpConsentInfo.fulfilled, (s, a) => {
        s.consentLoading = false;
        s.consent = a.payload;
      })
      .addCase(fetchMcpConsentInfo.rejected, (s, a) => {
        s.consentLoading = false;
        s.consentError = (a.payload as string) ?? "Error";
      })
      .addCase(decideMcpConsent.pending, (s) => {
        s.deciding = true;
        s.consentError = null;
      })
      .addCase(decideMcpConsent.fulfilled, (s) => {
        // Stay "deciding" while the browser navigates to the client
        s.deciding = true;
      })
      .addCase(decideMcpConsent.rejected, (s, a) => {
        s.deciding = false;
        s.consentError = (a.payload as string) ?? "Error";
      })
      .addCase(fetchMcpConnections.pending, (s) => {
        s.connectionsLoading = true;
        s.connectionsError = null;
      })
      .addCase(fetchMcpConnections.fulfilled, (s, a) => {
        s.connectionsLoading = false;
        s.connectorUrl = a.payload.connector_url;
        s.connections = a.payload.connections;
      })
      .addCase(fetchMcpConnections.rejected, (s, a) => {
        s.connectionsLoading = false;
        s.connectionsError = (a.payload as string) ?? "Error";
      })
      .addCase(revokeMcpConnection.pending, (s, a) => {
        s.revokingId = a.meta.arg;
        s.connectionsError = null;
      })
      .addCase(revokeMcpConnection.fulfilled, (s, a) => {
        s.revokingId = null;
        s.connections = s.connections.filter((c) => c.id !== a.payload);
      })
      .addCase(revokeMcpConnection.rejected, (s, a) => {
        s.revokingId = null;
        s.connectionsError = (a.payload as string) ?? "Error";
      });
  },
});

export const selectAdminMcp = (s: RootState) => s.adminMcp;

export default adminMcpSlice.reducer;
