// src/internal-components/DevTools.tsx
import React, { useEffect } from "react";

let MessageEmitter: React.FC<any> = ({ children }) => <>{children}</>;
let InternalErrorBoundary: React.FC<any> = ({ children }) => <>{children}</>;
let UserErrorBoundary: React.FC<any> = ({ children }) => <>{children}</>;

if (process.env.NODE_ENV === "development") {
  // dynamic require so TS only tries to resolve these in dev
  // @ts-ignore
  MessageEmitter = require("../dev-components/Beacon").MessageEmitter;
  // @ts-ignore
  InternalErrorBoundary = require("../dev-components/InternalErrorBoundary").InternalErrorBoundary;
  // @ts-ignore
  UserErrorBoundary = require("../dev-components/UserErrorBoundary").UserErrorBoundary;
}

export const DevTools: React.FC<{
  children: React.ReactNode;
  shouldRender: boolean;
}> = ({ children, shouldRender }) => {
  useEffect(() => {
    if (shouldRender && process.env.NODE_ENV === "development") {
      const logReason = (e: PromiseRejectionEvent) => console.error(e.reason);
      window.addEventListener("unhandledrejection", logReason);
      return () => window.removeEventListener("unhandledrejection", logReason);
    }
  }, [shouldRender]);

  if (shouldRender && process.env.NODE_ENV === "development") {
    return (
      <InternalErrorBoundary>
        <UserErrorBoundary>
          <MessageEmitter>{children}</MessageEmitter>
        </UserErrorBoundary>
      </InternalErrorBoundary>
    );
  }
  return <>{children}</>;
};
