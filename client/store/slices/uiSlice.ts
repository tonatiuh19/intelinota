import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UiState, ThemePreference } from "../types";

export const THEME_STORAGE_KEY = "intelinota_theme";

function readStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

const initialState: UiState = {
  theme: typeof window === "undefined" ? "system" : readStoredTheme(),
  searchOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemePreference>) {
      state.theme = action.payload;
    },
    setSearchOpen(state, action: PayloadAction<boolean>) {
      state.searchOpen = action.payload;
    },
  },
});

export const { setTheme, setSearchOpen } = uiSlice.actions;
export default uiSlice.reducer;
