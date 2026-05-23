import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><p>Cargando registro...</p></main>}>
      <AuthForm mode="registro" />
    </Suspense>
  );
}
