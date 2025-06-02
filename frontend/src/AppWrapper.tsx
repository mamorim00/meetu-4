/*import { RouterProvider } from "react-router-dom";
import { DEFAULT_THEME } from "./constants/default-theme";
import { Head } from "./internal-components/Head";
import { ThemeProvider } from "./internal-components/ThemeProvider";
import { OuterErrorBoundary } from "./prod-components/OuterErrorBoundary";
import { router } from "./router";
import { registerWebPush } from './utils/webPush';

export const AppWrapper = () => {
  return (
    <OuterErrorBoundary>
      <ThemeProvider defaultTheme={DEFAULT_THEME}>
        <RouterProvider router={router} />
        <Head />
      </ThemeProvider>
    </OuterErrorBoundary>
  );
};

*/
// ── frontend/src/AppWrapper.tsx ──

import React, { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { DEFAULT_THEME } from "./constants/default-theme";
import { Head } from "./internal-components/Head";
import { ThemeProvider } from "./internal-components/ThemeProvider";
import { OuterErrorBoundary } from "./prod-components/OuterErrorBoundary";
import { router } from "./router";

// Import the function that handles web‐push registration
import { registerWebPush } from "./utils/webPush";

export const AppWrapper: React.FC = () => {
  // Part 5: kick off the web‐push logic once, on mount
  useEffect(() => {
    registerWebPush();
  }, []);

  return (
    <OuterErrorBoundary>
      <ThemeProvider defaultTheme={DEFAULT_THEME}>
        <RouterProvider router={router} />
        <Head />
      </ThemeProvider>
    </OuterErrorBoundary>
  );
};
