// hoc/withAdmin.tsx
import { useAuth } from "@/app/provider/authProvider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const withAdmin = <P extends object>(Component: React.ComponentType<P>) => {
  return function ProtectedAdminComponent(props: P) {
    const { token, role, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && (!token || role !== "admin")) {
        router.replace("/"); // Если нет доступа, отправляем на главную
      }
    }, [token, role, isLoading, router]);

    if (isLoading) {
      return <></>; // Пока грузится токен, показываем индикатор
    }

    if (!token || role !== "admin") {
      return null; // Если не админ, ничего не рендерим
    }

    return <Component {...props} />;
  };
};

export default withAdmin;
