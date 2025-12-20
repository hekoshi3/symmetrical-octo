import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../provider/authProvider";

export default function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedComponent(props: P) {
    const { token, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !token) {
        router.replace("/auth");
      }
    }, [token, isLoading, router]);

    if (isLoading) {
      return <></>;
    }

    if (!token) {
      return null;
    }

    return <Component {...props} />;
  };
}
