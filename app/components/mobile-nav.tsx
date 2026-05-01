"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/app/components/sidebar";

export function MobileNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
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

      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
    </>
  );
}
