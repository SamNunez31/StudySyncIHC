import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><p>Cargando acceso...</p></main>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
