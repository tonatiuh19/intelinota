import * as Yup from "yup";

/** Same rule the API enforces (requires a TLD). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const newsletterSchema = Yup.object({
  email: Yup.string()
    .trim()
    .email("Introduce un correo válido")
    .matches(EMAIL_RE, "Introduce un correo válido")
    .max(255)
    .required("El correo es obligatorio"),
  website: Yup.string().max(0),
});

export const commentSchema = Yup.object({
  author_name: Yup.string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(150, "Máximo 150 caracteres")
    .required("Tu nombre es obligatorio"),
  author_email: Yup.string()
    .trim()
    .email("Correo inválido")
    .matches(EMAIL_RE, { message: "Correo inválido", excludeEmptyString: true })
    .max(255),
  content: Yup.string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(5000, "Máximo 5000 caracteres")
    .required("Escribe tu comentario"),
  website: Yup.string().max(0),
});

export const adminEmailSchema = Yup.object({
  email: Yup.string()
    .trim()
    .email("Correo inválido")
    .required("El correo es obligatorio"),
});

export const adminCodeSchema = Yup.object({
  code: Yup.string()
    .matches(/^\d{6}$/, "El código tiene 6 dígitos")
    .required("Introduce el código"),
});
