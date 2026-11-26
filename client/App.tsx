import "./global.css";
import "./lib/apiClient";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "@/components/ErrorBoundary";
import Analytics from "@/components/Analytics";
import AppRoutes from "./routes";
import { useThemeSync } from "@/hooks/use-theme";

function ThemeSync() {
  useThemeSync();
  return null;
}

const App = () => (
  <ErrorBoundary>
    <ThemeSync />
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Analytics />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
