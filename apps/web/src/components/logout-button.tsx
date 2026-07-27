import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { Button } from "@v7/ui/components/button";

export default function LogoutButton() {
  const navigate = useNavigate();

  return (
    <Button
      className="px-4 py-2 text-sm bg-red-800 text-white"
      onClick={() => {
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              navigate({ to: "/" });
            },
          },
        });
      }}
    >
      Sign Out
    </Button>
  );
}
