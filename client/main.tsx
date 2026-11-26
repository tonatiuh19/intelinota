import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import App from "./App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("No root element found");
}

// Edge middleware injects SEO tags for crawlers; react-helmet manages them
// client-side, so remove the static copies to avoid duplicates.
document.head
  .querySelectorAll("[data-edge]")
  .forEach((node) => node.remove());

const root = createRoot(container);
root.render(
  <Provider store={store}>
    <App />
  </Provider>,
);
