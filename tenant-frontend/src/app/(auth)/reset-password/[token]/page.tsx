/**
 * SECURITY FIX (MED-03): Password Reset Confirmation Page
 *
 * Página para confirmar reset de contraseña con token.
 *
 * Features:
 * - Validación de contraseña en tiempo real (zxcvbn - MED-02)
 * - Toggle de visualización de contraseña
 * - Feedback visual con estados de carga/éxito/error
 * - Redirección automática tras éxito
 * - Diseño responsive y accesible
 * - Validación de 8 caracteres mínimos (CRIT-01)
 *
 * Referencias:
 * - OWASP ASVS 4.0: 2.1.11 - Password reset functionality
 * - WCAG 2.1 AA - Accesibilidad
 *
 * Next.js 15 Note:
 * - Server Component que extrae token async
 * - Pasa token a Client Component para formulario interactivo
 */

import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  // Next.js 15: params es async y debe ser awaited
  const { token } = await params;

  return <ResetPasswordForm token={token} />;
}
