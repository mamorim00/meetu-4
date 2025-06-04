import { lazy, type ReactNode, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { userRoutes } from "./user-routes";

export const SuspenseWrapper = ({ children }: { children: ReactNode }) => {
  return <Suspense fallback={<div>Loading page...</div>}>{children}</Suspense>;
};

const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const SomethingWentWrongPage = lazy(() => import("./pages/SomethingWentWrongPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx")); 

export const router = createBrowserRouter([
  {
    path: "/privacy-policy",
    element: (
      <SuspenseWrapper>
        <PrivacyPolicy />
      </SuspenseWrapper>
    ),
  },
  {
    path: "/privacypolicy",
    element: (
      <SuspenseWrapper>
        <PrivacyPolicy />
      </SuspenseWrapper>
    ),
  },
  ...userRoutes,

  {
    path: "*",
    element: (
      <SuspenseWrapper>
        <NotFoundPage />
      </SuspenseWrapper>
    ),

    errorElement: (
      <SuspenseWrapper>
        <SomethingWentWrongPage />
      </SuspenseWrapper>
    ),
  },
]);
