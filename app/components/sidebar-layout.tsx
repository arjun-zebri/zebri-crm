"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4">
        <Link href="/">
          <img src="/zebri-icon.svg" alt="Zebri" className="w-[30px] h-[30px]" />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 text-gray-600 hover:text-gray-900 transition cursor-pointer"
        >
          <Menu size={22} strokeWidth={1.5} />
        </button>
      </div>

      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
      />

      <main
        className={`transition-[margin] duration-300 ease-in-out ${
          isExpanded ? "md:ml-60" : "md:ml-[68px]"
        } h-screen overflow-hidden pt-14 md:pt-0 flex flex-col`}
      >
        {children}
      </main>
    </>
  );
}
