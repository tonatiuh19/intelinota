/**
 * Intelinota MCP tool catalog (JSON Schema → zod via mcpJsonSchemaToZod).
 * Execution lives in api/index.ts, which invokes the SAME Express handlers the
 * admin UI uses, so permissions are exactly the signed-in user's rights.
 */
import { withMcpWriteConfirm, type McpToolDef } from "./mcpOAuth.js";

const id = (description: string) => ({ type: "integer", description });
const pageProps = {
  page: { type: "integer", description: "Página (1 por defecto)" },
  limit: { type: "integer", description: "Resultados por página (20 por defecto, máx. 50)" },
};

const articleFields = {
  title: { type: "string", description: "Título (máx. 90 caracteres recomendado)" },
  excerpt: { type: "string", description: "Entradilla/dek: 1–2 frases" },
  content: { type: "string", description: "Cuerpo de la nota, en Markdown o HTML (ver content_format)" },
  content_format: {
    type: "string",
    enum: ["markdown", "html"],
    description: "Formato de content. Markdown se convierte a HTML en el servidor. Por defecto markdown.",
  },
  category: { type: "string", description: "Categoría por slug (ver list_categories) o id numérico" },
  subcategory: { type: "string", description: "Subcategoría por slug o id (opcional)" },
  tags: { type: "array", items: { type: "string" }, description: "Etiquetas (nombres)" },
  slug: { type: "string", description: "Slug URL; si se omite se genera del título" },
  image_url: { type: "string", description: "URL de imagen principal (usa upload_image_from_url para subirla primero)" },
  meta_title: { type: "string", description: "Título SEO (máx. 160)" },
  meta_description: { type: "string", description: "Descripción SEO (máx. 320)" },
  read_time_minutes: { type: "integer", description: "Minutos de lectura (se estima si se omite)" },
};

const RAW: McpToolDef[] = [
  // ── READ ─────────────────────────────────────────────
  {
    name: "whoami",
    readOnly: true,
    description:
      "Úsala al inicio de la conversación: devuelve tu rol (admin/author), permisos (puede publicar, aprobar, moderar), perfil de autor vinculado y la zona horaria de la redacción.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_articles",
    readOnly: true,
    description:
      "Lista artículos del panel (los autores solo ven los suyos). Úsala para encontrar el id de una nota antes de leerla o editarla. Filtros: status, category (slug), q (texto), mine.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "in_review", "published", "scheduled", "archived"] },
        category: { type: "string", description: "Slug de categoría" },
        q: { type: "string", description: "Buscar en título y entradilla" },
        mine: { type: "boolean", description: "Solo mis artículos (útil para admins)" },
        ...pageProps,
      },
    },
  },
  {
    name: "get_article",
    readOnly: true,
    description:
      "Lee un artículo completo: metadatos, HTML, texto plano, conteo de palabras, updated_at (necesario para update_article) y edición pendiente si existe.",
    inputSchema: { type: "object", required: ["article_id"], properties: { article_id: id("Id del artículo") } },
  },
  {
    name: "search_published",
    readOnly: true,
    description:
      "Busca en lo PUBLICADO en el sitio (lo que ven los lectores), con facetas por categoría y autor. Úsala para verificar cobertura previa o enlazar notas relacionadas.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Texto a buscar" },
        category: { type: "string" },
        author: { type: "string", description: "Slug del autor" },
        tag: { type: "string", description: "Slug de etiqueta" },
        since: { type: "string", enum: ["24h", "7d", "30d", "1y"] },
        sort: { type: "string", enum: ["relevance", "recent", "popular"] },
        ...pageProps,
      },
    },
  },
  {
    name: "list_categories",
    readOnly: true,
    description: "Categorías activas con sus subcategorías (slug e id). Úsala antes de create_draft.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_authors",
    readOnly: true,
    description: "Autores del sitio con número de notas publicadas.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_tags",
    readOnly: true,
    description: "Etiquetas existentes (más usadas primero). Reutiliza etiquetas existentes en vez de inventar variantes.",
    inputSchema: { type: "object", properties: { q: { type: "string" }, ...pageProps } },
  },
  {
    name: "get_article_revisions",
    readOnly: true,
    description: "Historial de versiones de un artículo (para restore_revision).",
    inputSchema: { type: "object", required: ["article_id"], properties: { article_id: id("Id del artículo") } },
  },
  {
    name: "list_review_queue",
    readOnly: true,
    adminOnly: true,
    description: "(Admin) Cola de revisión: artículos en revisión y ediciones pendientes de notas publicadas.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_review_notes",
    readOnly: true,
    description: "Notas de revisión (devoluciones, aprobaciones) de un artículo.",
    inputSchema: { type: "object", required: ["article_id"], properties: { article_id: id("Id del artículo") } },
  },
  {
    name: "list_comments",
    readOnly: true,
    description:
      "Comentarios de lectores para moderar (admins: todos; autores: los de sus notas). Filtros: status, flagged (riesgo alto), q.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "approved", "spam", "all"] },
        flagged: { type: "boolean" },
        q: { type: "string" },
        article_id: id("Filtrar por artículo"),
        ...pageProps,
      },
    },
  },
  {
    name: "list_notifications",
    readOnly: true,
    description: "Tus notificaciones del panel (revisiones, devoluciones, aprobaciones).",
    inputSchema: { type: "object", properties: { unread_only: { type: "boolean" } } },
  },
  {
    name: "get_dashboard_stats",
    readOnly: true,
    description: "Tus números (artículos, vistas, top 10, vistas por día). Para admins: todo el sitio.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_audit_log",
    readOnly: true,
    adminOnly: true,
    description: "(Admin) Bitácora de acciones del panel.",
    inputSchema: { type: "object", properties: { ...pageProps } },
  },
  {
    name: "check_slug",
    readOnly: true,
    description: "Verifica si un slug está libre y sugiere uno alternativo.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: { slug: { type: "string" }, exclude_article_id: id("Excluir este artículo") },
    },
  },

  // ── WRITE ────────────────────────────────────────────
  {
    name: "create_draft",
    readOnly: false,
    description:
      "Crea un BORRADOR nuevo (nunca publica). content en Markdown (recomendado) o HTML; se sanitiza igual que en el editor. Categoría por slug o id.",
    inputSchema: {
      type: "object",
      required: ["title", "category", "content"],
      properties: {
        ...articleFields,
        author_id: id("(Admin) Autor de la nota; por defecto tu perfil de autor"),
      },
    },
  },
  {
    name: "update_article",
    readOnly: false,
    description:
      "Edita campos de un artículo (parcial). Requiere expected_updated_at (de get_article) para no pisar cambios ajenos. Si la nota está publicada y no puedes publicar, el cambio queda PENDIENTE de revisión.",
    inputSchema: {
      type: "object",
      required: ["article_id", "expected_updated_at"],
      properties: {
        article_id: id("Id del artículo"),
        expected_updated_at: { type: "string", description: "updated_at ISO devuelto por get_article" },
        ...articleFields,
      },
    },
  },
  {
    name: "submit_for_review",
    readOnly: false,
    description: "Envía un borrador a revisión editorial (estado in_review) y notifica a los editores.",
    inputSchema: {
      type: "object",
      required: ["article_id", "expected_updated_at"],
      properties: { article_id: id("Id del artículo"), expected_updated_at: { type: "string" } },
    },
  },
  {
    name: "publish_article",
    readOnly: false,
    description:
      "Publica ahora o programa (publish_at ISO; sin zona horaria se interpreta en la zona de la redacción). Solo si tienes permiso de publicar; si no, usa submit_for_review.",
    inputSchema: {
      type: "object",
      required: ["article_id", "expected_updated_at"],
      properties: {
        article_id: id("Id del artículo"),
        expected_updated_at: { type: "string" },
        publish_at: { type: "string", description: "Fecha/hora ISO futura para programar; omitir = ahora" },
      },
    },
  },
  {
    name: "archive_article",
    readOnly: false,
    description: "Archiva (retira del sitio) un artículo. Requiere permiso de publicar.",
    inputSchema: {
      type: "object",
      required: ["article_id", "expected_updated_at"],
      properties: { article_id: id("Id del artículo"), expected_updated_at: { type: "string" } },
    },
  },
  {
    name: "restore_revision",
    readOnly: false,
    description: "Restaura el contenido de una versión anterior (de get_article_revisions). No cambia el estado de publicación.",
    inputSchema: {
      type: "object",
      required: ["article_id", "revision_id"],
      properties: { article_id: id("Id del artículo"), revision_id: id("Id de la versión") },
    },
  },
  {
    name: "upload_image_from_url",
    readOnly: false,
    description:
      "Descarga una imagen pública (solo https, máx. 10 MB) y la sube a la mediateca. Devuelve la URL para usar como image_url. Usa solo imágenes con derechos de uso.",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", description: "URL https de la imagen" },
        alt_text: { type: "string", description: "Texto alternativo descriptivo (español)" },
      },
    },
  },
  {
    name: "set_featured",
    readOnly: false,
    adminOnly: true,
    description: "(Admin) Destaca o quita de portada un artículo (máx. 5 destacados; desplaza el más antiguo).",
    inputSchema: {
      type: "object",
      required: ["article_id", "featured"],
      properties: {
        article_id: id("Id del artículo"),
        featured: { type: "boolean" },
        trending: { type: "boolean", description: "Marcar también como tendencia" },
      },
    },
  },
  {
    name: "approve_article",
    readOnly: false,
    adminOnly: true,
    description: "(Admin) Aprueba un artículo en revisión: lo publica ahora o lo programa (publish_at).",
    inputSchema: {
      type: "object",
      required: ["article_id"],
      properties: { article_id: id("Id del artículo"), publish_at: { type: "string" }, note: { type: "string" } },
    },
  },
  {
    name: "return_article",
    readOnly: false,
    adminOnly: true,
    description: "(Admin) Devuelve al autor un artículo en revisión con una nota obligatoria de qué corregir.",
    inputSchema: {
      type: "object",
      required: ["article_id", "note"],
      properties: { article_id: id("Id del artículo"), note: { type: "string" } },
    },
  },
  {
    name: "approve_pending_edit",
    readOnly: false,
    adminOnly: true,
    description: "(Admin) Aplica en vivo una edición pendiente de una nota publicada (revision_id de list_review_queue).",
    inputSchema: {
      type: "object",
      required: ["revision_id"],
      properties: { revision_id: id("Id de la edición pendiente"), note: { type: "string" } },
    },
  },
  {
    name: "reject_pending_edit",
    readOnly: false,
    adminOnly: true,
    description: "(Admin) Rechaza una edición pendiente con nota obligatoria.",
    inputSchema: {
      type: "object",
      required: ["revision_id", "note"],
      properties: { revision_id: id("Id de la edición pendiente"), note: { type: "string" } },
    },
  },
  {
    name: "moderate_comments",
    readOnly: false,
    description: "Modera comentarios en lote: approve, spam, pending o delete (delete solo admin).",
    inputSchema: {
      type: "object",
      required: ["ids", "action"],
      properties: {
        ids: { type: "array", items: { type: "integer" }, description: "Ids de comentarios (máx. 100)" },
        action: { type: "string", enum: ["approve", "spam", "pending", "delete"] },
      },
    },
  },
  {
    name: "reply_to_comment",
    readOnly: false,
    description: "Responde públicamente a un comentario como la redacción (con tu nombre).",
    inputSchema: {
      type: "object",
      required: ["comment_id", "content"],
      properties: { comment_id: id("Id del comentario"), content: { type: "string" } },
    },
  },
  {
    name: "mark_notifications_read",
    readOnly: false,
    description: "Marca notificaciones como leídas: ids concretos o all=true.",
    inputSchema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "integer" } }, all: { type: "boolean" } },
    },
  },
];

export const MCP_TOOLS: McpToolDef[] = RAW.map(withMcpWriteConfirm);

export const MCP_PROMPTS = [
  {
    name: "redactar_nota",
    description: "Guía para redactar una nota con el estilo de la casa Intelinota y guardarla como borrador.",
    args: { tema: "Tema o hechos de la nota", fuentes: "Fuentes/enlaces disponibles (opcional)" },
    build: (a: Record<string, string | undefined>) =>
      [
        `Redacta una nota periodística para INTELINOTA sobre: ${a.tema ?? "(tema)"}.`,
        a.fuentes ? `Fuentes disponibles: ${a.fuentes}` : "Pide o indica las fuentes que respaldan cada dato.",
        "Estilo de la casa:",
        "- Español de México (es-MX), tono informativo, claro y verificable; sin clickbait.",
        "- Título de máximo 90 caracteres, en oración (solo mayúscula inicial y nombres propios).",
        "- Entradilla (excerpt) de 1–2 frases que responda qué, quién, cuándo.",
        "- Cuerpo en Markdown con secciones ## (H2); párrafos breves; cifras con fuente.",
        "- Cierra con una sección «## Fuentes» con enlaces.",
        "Flujo: whoami → list_categories → search_published (evitar duplicar) → create_draft (vista previa, luego confirm).",
      ].join("\n"),
  },
  {
    name: "revisar_nota",
    description: "Revisión editorial de un borrador existente (estilo, datos, SEO) antes de enviarlo a revisión.",
    args: { article_id: "Id del artículo" },
    build: (a: Record<string, string | undefined>) =>
      [
        `Lee el artículo ${a.article_id ?? ""} con get_article y entrega una revisión editorial:`,
        "1) Errores de ortografía/estilo es-MX. 2) Afirmaciones sin fuente. 3) Título ≤ 90 caracteres y entradilla de 1–2 frases.",
        "4) Sugerencias de meta_title/meta_description. 5) Etiquetas existentes (list_tags).",
        "Propón los cambios y aplica con update_article solo si el usuario los aprueba.",
      ].join("\n"),
  },
  {
    name: "moderar_comentarios",
    description: "Revisa comentarios pendientes y propone una moderación en lote.",
    args: {},
    build: () =>
      [
        "Usa list_comments con status=pending (y flagged=true primero).",
        "Clasifica cada uno en aprobar / spam / dejar pendiente, con una razón breve.",
        "Muestra la tabla al usuario y aplica con moderate_comments solo tras su aprobación.",
      ].join("\n"),
  },
];
