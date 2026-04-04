import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Activity className="h-10 w-10 text-primary mb-4" />
      <h1 className="text-5xl font-bold text-foreground mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-6">Page not found</p>
      <Button asChild>
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </div>
  );
};

export default NotFound;
