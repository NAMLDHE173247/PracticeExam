"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { LABELS } from "@/lib/constants/labels";

export function SidebarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored === "true") {
      setIsCollapsed(true);
    }
  }, []);

  // Save to localStorage when changed
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
  };

  return (
    <div className={`dashboard-shell ${isCollapsed ? "sidebar-collapsed" : ""}`}>
      <nav className="app-sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <span aria-hidden="true" className="brand-icon">Q</span>
          <strong className="link-text">Questionly</strong>
        </div>
        
        <p className="sidebar-section-label">{LABELS.WORKSPACE}</p>
        
        <div className="sidebar-nav-links">
          <Link
            className={`sidebar-nav-link ${pathname === "/" ? "active" : ""}`}
            href="/#question-sets"
          >
            <span aria-hidden="true">▤</span>
            <span className="link-text">{LABELS.QUESTION_SETS}</span>
          </Link>
          <Link
            className={`sidebar-nav-link`}
            href="/#subjects"
          >
            <span aria-hidden="true">◈</span>
            <span className="link-text">{LABELS.SUBJECTS}</span>
          </Link>
          <Link
            className={`sidebar-nav-link`}
            href="/#analytics"
          >
            <span aria-hidden="true">▥</span>
            <span className="link-text">{LABELS.ANALYTICS}</span>
          </Link>
          <Link
            className={`sidebar-nav-link ${pathname === "/questions/import" ? "active" : ""}`}
            href="/questions/import"
          >
            <span aria-hidden="true">↥</span>
            <span className="link-text">{LABELS.IMPORT_QUESTIONS}</span>
          </Link>
        </div>
        
        <div className="sidebar-footer">
          <span className="link-text">Practice exam<br /><span>{LABELS.CONTENT_MANAGEMENT}</span></span>
        </div>

        <button 
          className="sidebar-toggle" 
          onClick={toggleSidebar} 
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span aria-hidden="true">{isCollapsed ? "»" : "«"}</span>
        </button>
      </nav>

      {children}
    </div>
  );
}
