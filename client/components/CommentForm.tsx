import { useFormik } from "formik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { postComment } from "@/store/slices/commentsSlice";
import { commentSchema } from "@/lib/validation/schemas";

function FieldError({ message }: { message?: string | false }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

export default function CommentForm({ slug }: { slug: string }) {
  const dispatch = useAppDispatch();
  const posting = useAppSelector((s) => s.comments.posting);
  const { toast } = useToast();

  const formik = useFormik({
    initialValues: { author_name: "", author_email: "", content: "", website: "" },
    validationSchema: commentSchema,
    onSubmit: async (values, helpers) => {
      const result = await dispatch(
        postComment({
          slug,
          payload: {
            author_name: values.author_name.trim(),
            author_email: values.author_email.trim() || undefined,
            content: values.content.trim(),
            website: values.website,
          },
        }),
      );
      if (postComment.fulfilled.match(result)) {
        helpers.resetForm({
          values: { ...values, content: "", website: "" },
        });
        toast({ title: "Comentario enviado", description: result.payload.message });
      } else {
        toast({
          title: "No se pudo enviar",
          description: String(result.payload ?? ""),
          variant: "destructive",
        });
      }
    },
  });

  const err = (k: "author_name" | "author_email" | "content") =>
    formik.touched[k] && formik.errors[k];

  return (
    <form
      onSubmit={formik.handleSubmit}
      noValidate
      className="space-y-4 border-t border-border pt-6"
    >
      <p className="text-xs text-muted-foreground">
        Los comentarios se revisan antes de publicarse.
      </p>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        value={formik.values.website}
        onChange={formik.handleChange}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="comment-name">Nombre</Label>
          <Input
            id="comment-name"
            {...formik.getFieldProps("author_name")}
            aria-invalid={Boolean(err("author_name"))}
            autoComplete="name"
            placeholder="Tu nombre"
          />
          <FieldError message={err("author_name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comment-email">Correo (opcional, no se publica)</Label>
          <Input
            id="comment-email"
            type="email"
            {...formik.getFieldProps("author_email")}
            aria-invalid={Boolean(err("author_email"))}
            autoComplete="email"
            placeholder="tu@email.com"
          />
          <FieldError message={err("author_email")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="comment-content">Comentario</Label>
        <Textarea
          id="comment-content"
          {...formik.getFieldProps("content")}
          aria-invalid={Boolean(err("content"))}
          rows={4}
          placeholder="Escribe tu opinión…"
        />
        <div className="flex items-center justify-between">
          <FieldError message={err("content")} />
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {formik.values.content.length}/5000
          </span>
        </div>
      </div>
      <Button type="submit" disabled={posting} className="h-11">
        {posting ? "Enviando…" : "Enviar comentario"}
      </Button>
    </form>
  );
}
