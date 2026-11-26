# GitHub Copilot Custom Instructions

## ⚠️ CRITICAL RULES - MUST FOLLOW

- **ALWAYS reference `database/schema.sql` for exact table structure and column names**
- **NEVER assume column names - verify in schema.sql before writing SQL queries**
- **NEVER fetch data directly in components with axios or fetch**
- **ALL data fetching MUST be done in Redux store (slices) using createAsyncThunk**
- **Components ONLY dispatch actions and select state from store**
- **NO EXCEPTIONS to these rules**
- **NEVER touch schema.sql, any database changes must be made through migration files in `database/migrations/`**
- **When using any console logging for debugging use logger functions from `client/utils/logger.ts` for consistent formatting and log levels only in UI components**
- **NEVER Patch issues, always fix the root cause of type errors or bugs immediately**

### Package Manager

- **Always use npm** (never pnpm or yarn)
- **Always use logger** for debugging (e.g., `console.log`, `console.error`) inside lib folder

### Backend

- APIs are in `api/index.ts` — deployed as a **Vercel Serverless Function**
- TypeScript throughout
- Single port (8080) for both frontend/backend in development (`vite dev` proxies `/api/*` to the Express serverless handler)
- **CRITICAL: Always reference `database/schema.sql` for database structure and table definitions**
- **NEVER assume column names - check schema.sql first**
- **If any database update is made based on schema.sql, generate a migration file** in `database/migrations/` with timestamp prefix (e.g., `YYYYMMDD_HHMMSS_description.sql`) for MySQL 8.0
- **If a type issue is generated, fix it immediately** - ensure all TypeScript types are correct and consistent across client, api/index.ts, and shared

### Running Migrations (TiDB Cloud)

DB credentials are in `.env` at the project root. To apply a migration:

```bash
# 1. Check if already applied (table check example)
DB_PASS=$(grep "^DB_PASSWORD" .env | cut -d'=' -f2-) && \
DB_HOST=$(grep "^DB_HOST" .env | cut -d'=' -f2-) && \
DB_PORT=$(grep "^DB_PORT" .env | cut -d'=' -f2-) && \
DB_USER=$(grep "^DB_USER" .env | cut -d'=' -f2-) && \
DB_NAME=$(grep "^DB_NAME" .env | cut -d'=' -f2-) && \
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  --ssl-mode=REQUIRED --protocol=TCP \
  -e "SHOW TABLES LIKE 'your_table_name';" 2>&1

# 2. Apply the migration
DB_PASS=$(grep "^DB_PASSWORD" .env | cut -d'=' -f2-) && \
DB_HOST=$(grep "^DB_HOST" .env | cut -d'=' -f2-) && \
DB_PORT=$(grep "^DB_PORT" .env | cut -d'=' -f2-) && \
DB_USER=$(grep "^DB_USER" .env | cut -d'=' -f2-) && \
DB_NAME=$(grep "^DB_NAME" .env | cut -d'=' -f2-) && \
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  --ssl-mode=REQUIRED --protocol=TCP \
  < database/migrations/YOUR_MIGRATION_FILE.sql 2>&1

# 3. Verify
DB_PASS=$(grep "^DB_PASSWORD" .env | cut -d'=' -f2-) && \
DB_HOST=$(grep "^DB_HOST" .env | cut -d'=' -f2-) && \
DB_PORT=$(grep "^DB_PORT" .env | cut -d'=' -f2-) && \
DB_USER=$(grep "^DB_USER" .env | cut -d'=' -f2-) && \
DB_NAME=$(grep "^DB_NAME" .env | cut -d'=' -f2-) && \
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  --ssl-mode=REQUIRED --protocol=TCP \
  -e "DESCRIBE your_table_name;" 2>&1
```

- All DB connection values are in `.env` (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
- Always use `--ssl-mode=REQUIRED --protocol=TCP`
- After applying, **update `database/schema.sql`** to reflect the new table/column

### Deployment (Vercel)

- Hosting: **Vercel** — `vercel.json` controls build and routing
- Build command: `npm run build:client` → output to `dist/spa/`
- API serverless function: `api/index.ts` (Express wrapped with `@vercel/node`)
- All `/api/*` requests are rewritten to `api/index.ts`; all other routes rewrite to `index.html` (SPA)
- Environment variables must be set in the **Vercel dashboard** (not committed to git)

## Project Structure

### Client (Frontend)

- `client/pages/` - Route components (Index.tsx = home page)
- `client/components/ui/` - Pre-built UI component library
- `client/App.tsx` - App entry point with SPA routing setup
- `client/global.css` - TailwindCSS theming and global styles
- Add cool, engage, modern UI components
- Need to use cool animations and transitions for smooth UX
- When console logging for debugging, always use logger functions from `client/utils/logger.ts` for consistent formatting and log levels

### Shared

- `shared/` - Types and interfaces used by both client and server
- `shared/api.ts` - Shared API interfaces

## Path Aliases

- `@/*` - Maps to `client/` folder
- `@shared/*` - Maps to `shared/` folder

Always use these aliases instead of relative imports.

## Styling Guidelines

### Primary Styling Method

- Use TailwindCSS 3 utility classes as the primary styling method
- Configure theme and design tokens in `client/global.css` and `tailwind.config.ts`
- **Always follow the color palette defined in `client/global.css`** - use existing theme colors
- **Keep designs simple, cool, and engaging** - prioritize clean UX

### ⚠️ MOBILE RESPONSIVENESS — MANDATORY STANDARD

**Every feature, component, page, and UI change MUST be fully mobile responsive. No exceptions.**

- **Design mobile-first**: start with the smallest viewport, then enhance for larger screens using Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`)
- **Never use fixed widths** that would overflow on mobile (e.g., `w-[500px]` without a `max-w-full` or responsive override)
- **Typography must scale**: large headings need responsive sizing (e.g., `text-2xl sm:text-4xl md:text-6xl`), never use large fixed sizes like `text-6xl` without a smaller mobile fallback
- **Grids must stack on mobile**: always add `grid-cols-1` as base, scale up with `sm:grid-cols-2 lg:grid-cols-3`
- **Flex layouts must wrap or stack**: use `flex-wrap` or `flex-col sm:flex-row` for horizontal groups
- **Touch targets**: interactive elements (buttons, links) must have minimum `h-10 w-10` hit area; action buttons inside cards/rows that use `opacity-0 hover:opacity-100` must use `sm:opacity-0 sm:group-hover:opacity-100` so they remain visible on touch devices
- **Fixed/sticky elements**: headers and sidebars must not cover content — use appropriate `top-*` offsets for sticky children
- **Sidebars/panels**: desktop sidebars must use `hidden lg:flex` and provide a mobile drawer/sheet with a toggle button
- **Modals/dialogs**: use `w-[calc(100vw-1rem)] sm:w-full max-w-*` to prevent edge overflow on small screens
- **Images**: always use `w-full object-cover` inside aspect-ratio containers; never fixed `width`/`height` pixel values on images
- **Horizontal scroll**: avoid it except in deliberate scroll containers (carousels, code blocks, toolbar strips) — use `overflow-x-auto` intentionally, not as a fallback
- **Padding/spacing**: use `px-4 sm:px-6 lg:px-8` or the `container` class; never omit horizontal padding on mobile
- **Test every new UI at these breakpoints**: 375px (iPhone SE), 430px (iPhone 14 Pro Max), 768px (tablet), 1280px (desktop)

## API Development

### When to Create API Endpoints

**Only create API endpoints when strictly necessary**, such as:

- Handling private keys or secrets
- Database operations
- Server-side logic that cannot be exposed to the client

4. Use in React components with Redux store and axios

```typescript
import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { MyRouteResponse } from "@shared/api";

// In your slice file
export const fetchMyData = createAsyncThunk("mySlice/fetchMyData", async () => {
  const { data } = await axios.get<MyRouteResponse>("/api/my-endpoint");
  return data;
});
```

## State Management

### ⚠️ DATA FETCHING RULES (MANDATORY)

**CRITICAL: ALL data fetching MUST happen in Redux store, NEVER in components**

✅ **CORRECT Pattern:**

```typescript
// In client/store/slices/mySlice.ts
export const fetchData = createAsyncThunk(
  "slice/fetchData",
  async (_, { getState }) => {
    const { sessionToken } = (getState() as RootState).brokerAuth;
    const { data } = await axios.get("/api/endpoint", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    return data;
  },
);

// In component
const dispatch = useAppDispatch();
const { data, loading } = useAppSelector((state) => state.mySlice);

useEffect(() => {
  dispatch(fetchData());
}, [dispatch]);
```

❌ **INCORRECT Pattern (NEVER DO THIS):**

```typescript
// WRONG: Direct axios call in component
const [data, setData] = useState([]);
useEffect(() => {
  axios.get("/api/endpoint").then((res) => setData(res.data)); // ❌ NEVER DO THIS
}, []);
```

### General Redux Rules

- **Always use Redux store** (`client/store/`) for state management
- Use Redux hooks: `useAppDispatch` and `useAppSelector` from `client/store/hooks.ts`
- Create slices in `client/store/slices/` following existing patterns
- Never use local state for data that should be shared across components
- **Always use axios for API calls from Redux store** - never use fetch directly
- Use `createAsyncThunk` for async operations in slices
- Components should only dispatch actions and select state from the store

## Form Validation

- **Always use Formik with Yup** for form validation
- Create Yup schemas for all forms
- Use Formik hooks: `useFormik` or `<Formik>` component
- Define validation schemas separately for reusability
- Example:

```typescript
import { useFormik } from "formik";
import * as Yup from "yup";

const validationSchema = Yup.object({
  email: Yup.string().email("Invalid email").required("Required"),
  name: Yup.string().required("Required"),
});

const formik = useFormik({
  initialValues: { email: "", name: "" },
  validationSchema,
  onSubmit: (values) => dispatch(submitForm(values)),
});
```

## Component Guidelines

### UI Components

- Pre-built UI component library available in `client/components/ui/`
- Components use Radix UI primitives with TailwindCSS styling
- Always check existing UI components before creating new ones
- **Keep UI simple, cool, and engaging** - focus on clean user experience

### Icons

- Use Lucide React icons library as primary choice
- Import from `lucide-react`
- If Lucide doesn't have a cool/engaging icon, use react-icons as alternative
- Import from `react-icons` (e.g., `react-icons/fa`, `react-icons/bs`, etc.)

## Remote MCP

- Server: `POST /api/mcp` (Streamable HTTP, stateless, `enableJsonResponse`), OAuth 2.1 issuer/resource `${BASE_URL}/api/mcp`, scope `intelinota.newsroom`. Full docs: `mcp/README.md`.
- **Permissions = the user's rights**: MCP tools MUST call the existing Express handlers via `invokeAsUser` (never re-implement permission logic or write SQL that bypasses handler rules). Admin-only tools prepend `requireAdmin`.
- New tools: add the JSON schema to `api/_lib/mcpTools.ts` (snake_case, Spanish description that says *when* to use it, `readOnly`, `adminOnly`), then a `case` in `executeMcpTool`. Writes get `confirm` + `confirm_phrase=CONFIRM` automatically and must return a dry-run preview when not confirmed.
- Keep `tools/list` Claude-safe: only `{ name, description, inputSchema }` (`mcpToolsListForClaude`, `sanitizeMcpJsonRpcForClaude`).
- Tokens/codes are stored only as sha256; never log them. Every call writes `mcp_audit_logs`.
- `@modelcontextprotocol/sdk` (1.31.0) and `markdown-it` (14.3.3) are pinned for CommonJS compatibility — run `npm run check:api-runtime` after any bump.
- `vercel.json` rewrites `/.well-known/(oauth-…|openid-configuration)` to `/api/index.ts` before the SPA catch-all.
