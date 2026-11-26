import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setTheme, THEME_STORAGE_KEY } from "@/store/slices/uiSlice";
import type { ThemePreference } from "@/store/types";

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/**
 * Applies the theme preference to <html> (class="dark") and keeps it in
 * sync with the OS when the preference is "system". Mount once (App).
 */
export function useThemeSync() {
  const theme = useAppSelector((s) => s.ui.theme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* storage unavailable */
    }
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

/** Current resolved theme + setter for toggles. */
export function useTheme() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === "undefined" ? false : systemPrefersDark(),
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  return {
    theme,
    resolved,
    setTheme: (t: ThemePreference) => dispatch(setTheme(t)),
    toggle: () => dispatch(setTheme(resolved === "dark" ? "light" : "dark")),
  };
}
