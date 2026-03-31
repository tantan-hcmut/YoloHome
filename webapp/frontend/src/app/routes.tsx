import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Devices } from "./pages/Devices";
import { Schedule } from "./pages/Schedule";
import { Settings } from "./pages/Settings";

// Root route - check auth and redirect
const RootRoute = () => {
  const token = localStorage.getItem("token");
  
  // If no token, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  // Token exists, redirect to dashboard
  return <Navigate to="/dashboard" replace />;
};

// Protected layout wrapper - checks auth and wraps all protected routes
const ProtectedLayout = () => {
  const token = localStorage.getItem("token");
  
  // If no token, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  // Token exists, show protected layout with nested route
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

// Login route wrapper - redirect to dashboard if already logged in
const LoginRoute = () => {
  const token = localStorage.getItem("token");
  
  // If already logged in, redirect to dashboard
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Login />;
};

export const router = createBrowserRouter([
  // Root path - check auth and redirect
  {
    path: "/",
    Component: RootRoute,
  },
  // Login path
  {
    path: "/login",
    Component: LoginRoute,
  },
  // Protected routes - all ngang hàng (siblings)
  {
    Component: ProtectedLayout,
    children: [
      { path: "/dashboard", Component: Dashboard },
      { path: "/devices", Component: Devices },
      { path: "/schedule", Component: Schedule },
      { path: "/settings", Component: Settings },
    ],
  },
]);