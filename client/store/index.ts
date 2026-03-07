import { configureStore } from "@reduxjs/toolkit";
import articlesReducer from "./slices/articlesSlice";
import categoriesReducer from "./slices/categoriesSlice";
import homeReducer from "./slices/homeSlice";
import type { RootState } from "./types";

export const store = configureStore({
  reducer: {
    articles: articlesReducer,
    categories: categoriesReducer,
    home: homeReducer,
  },
});

export type { RootState };
export type AppDispatch = typeof store.dispatch;
