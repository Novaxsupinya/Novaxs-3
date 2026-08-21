import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFoundPage = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-slate-600 mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/">
        <Button className="bg-orange-500 hover:bg-orange-600">Back to Home</Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
