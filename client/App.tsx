import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Article from "./pages/Article";
import Category from "./pages/Category";
import Placeholder from "./pages/Placeholder";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/article/:slug" element={<Article />} />
              <Route path="/category/:category" element={<Category />} />
              <Route
                path="/admin"
                element={<Placeholder title="Admin Dashboard" />}
              />
              <Route
                path="/about"
                element={<Placeholder title="Our Story" />}
              />
              <Route path="/team" element={<Placeholder title="The Team" />} />
              <Route
                path="/contact"
                element={<Placeholder title="Contact Us" />}
              />
              <Route
                path="/privacy"
                element={<Placeholder title="Privacy Policy" />}
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
