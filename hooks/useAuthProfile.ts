"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentProfile } from "@/lib/data";
import type { Profile, Role } from "@/lib/types";

export function useAuthProfile(requiredRole?: Role) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let mounted = true;
    const redirectPath = `${pathname}${window.location.search}`;

    getCurrentProfile().then(({ user, profile: currentProfile }) => {
      if (!mounted) return;

      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
        return;
      }

      setUserId(user.id);
      setProfile(currentProfile);
      setForbidden(Boolean(requiredRole && currentProfile?.role !== requiredRole));
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [pathname, requiredRole, router]);

  return { profile, userId, loading, forbidden };
}
