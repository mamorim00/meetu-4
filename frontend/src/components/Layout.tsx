import React from "react";
import { Navigation } from "./Navigation";

interface LayoutProps {
  hideNav?: boolean; 
  children: React.ReactNode;
  /** Optional title shown at the top of the content area */
  title?: string;
  /** Additional padding or margin classes for the main content area */
  contentClassName?: string;
}

/**
 * Layout component providing consistent structure for all pages
 * Includes navigation and proper spacing for content
 */
export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title,
  contentClassName = ""
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Navigation */}
      <Navigation />

      {/* Main Content Area with padding for desktop nav */}
      <div className="md:ml-64 flex-1 flex flex-col w-[calc(100%-16rem)]"> {/* Add margin and constrain width to prevent overlap */}
        {/* Main Content */}
        <main className={`flex-grow pb-20 md:pb-8 ${contentClassName}`}>
          {title && (
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 py-4 px-6 mb-4 md:mb-6">
              <h1 className="text-2xl font-bold">{title}</h1>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};
