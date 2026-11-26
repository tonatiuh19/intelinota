import { configureStore } from "@reduxjs/toolkit";
import articlesReducer from "./slices/articlesSlice";
import categoriesReducer from "./slices/categoriesSlice";
import homeReducer from "./slices/homeSlice";
import authorsReducer from "./slices/authorsSlice";
import commentsReducer from "./slices/commentsSlice";
import newsletterReducer from "./slices/newsletterSlice";
import adminAuthReducer from "./slices/adminAuthSlice";
import adminArticlesReducer from "./slices/adminArticlesSlice";
import adminAuthorsReducer from "./slices/adminAuthorsSlice";
import adminCommentsReducer from "./slices/adminCommentsSlice";
import adminCategoriesReducer from "./slices/adminCategoriesSlice";
import adminNewsletterReducer from "./slices/adminNewsletterSlice";
import adminSettingsReducer from "./slices/adminSettingsSlice";
import adminDashboardReducer from "./slices/adminDashboardSlice";
import adminMediaReducer from "./slices/adminMediaSlice";
import uiReducer from "./slices/uiSlice";
import searchReducer from "./slices/searchSlice";
import tagsReducer from "./slices/tagsSlice";
import searchPageReducer from "./slices/searchPageSlice";
import bookmarksReducer from "./slices/bookmarksSlice";
import articleEditorReducer from "./slices/articleEditorSlice";
import revisionsReducer from "./slices/revisionsSlice";
import adminAuditReducer from "./slices/adminAuditSlice";
import adminReviewsReducer from "./slices/adminReviewsSlice";
import notificationsReducer from "./slices/notificationsSlice";
import adminMcpReducer from "./slices/adminMcpSlice";
import type { RootState } from "./types";

export const store = configureStore({
  reducer: {
    articles: articlesReducer,
    categories: categoriesReducer,
    home: homeReducer,
    authors: authorsReducer,
    comments: commentsReducer,
    newsletter: newsletterReducer,
    adminAuth: adminAuthReducer,
    adminArticles: adminArticlesReducer,
    adminAuthors: adminAuthorsReducer,
    adminComments: adminCommentsReducer,
    adminCategories: adminCategoriesReducer,
    adminNewsletter: adminNewsletterReducer,
    adminSettings: adminSettingsReducer,
    adminDashboard: adminDashboardReducer,
    adminMedia: adminMediaReducer,
    ui: uiReducer,
    search: searchReducer,
    tags: tagsReducer,
    searchPage: searchPageReducer,
    bookmarks: bookmarksReducer,
    articleEditor: articleEditorReducer,
    revisions: revisionsReducer,
    adminAudit: adminAuditReducer,
    adminReviews: adminReviewsReducer,
    notifications: notificationsReducer,
    adminMcp: adminMcpReducer,
  },
});

export type { RootState };
export type AppDispatch = typeof store.dispatch;
