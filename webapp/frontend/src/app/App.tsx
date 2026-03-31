import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  // Don't clear token on app load - let auth flow handle it
  return <RouterProvider router={router} />;
}
