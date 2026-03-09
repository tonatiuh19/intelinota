import { configureStore } from "@reduxjs/toolkit";
import articlesReducer from "./slices/articlesSlice";
import categoriesReducer from "./slices/categoriesSlice";
import homeReducer from "./slices/homeSlice";
import adminAuthReducer from "./slices/adminAuthSlice";
import adminArticlesReducer from "./slices/adminArticlesSlice";
import adminAuthorsReducer from "./slices/adminAuthorsSlice";
import adminDashboardReducer from "./slices/adminDashboardSlice";
import type { RootState } from "./types";

export const store = configureStore({
  reducer: {
    articles: articlesReducer,
    categories: categoriesReducer,
    home: homeReducer,
    adminAuth: adminAuthReducer,
    adminArticles: adminArticlesReducer,
    adminAuthors: adminAuthorsReducer,
    adminDashboard: adminDashboardReducer,
  },
});

export type { RootState };
export type AppDispatch = typeof store.dispatch;
