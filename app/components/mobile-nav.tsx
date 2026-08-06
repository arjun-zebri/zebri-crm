"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Sidebar } from "@/app/components/sidebar";

export function MobileNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border z-30 flex items-center justify-between px-4">
        <Link href="/">
          <img src="/zebri-icon.svg" alt="Zebri" className="w-[30px] h-[30px]" />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 text-gray-600 hover:text-text transition cursor-pointer"
        >
          <Menu size={22} strokeWidth={1.5} />
        </button>
      </div>

      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} isExpanded={false} onToggle={() => {}} />
    </>
  );
}
