"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  Target,
  Users,
  Settings,
  LogOut,
  Calendar,
  CheckSquare,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Couples", href: "/couples", icon: Target },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Vendors", href: "/vendors", icon: Users },
];

const bottomItems = [
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onMobileClose}
      />

      <aside
        className={`group/sidebar fixed top-0 left-0 h-screen w-[280px] md:w-[68px] md:hover:w-60 border-r border-gray-200 bg-white flex flex-col transition-all duration-300 ease-in-out z-50 overflow-hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <Link
          href="/"
          onClick={onMobileClose}
          className="flex items-center hover:opacity-80 transition px-[16px] pt-4"
        >
          <img
            src="/zebri-icon.svg"
            alt="Zebri"
            className="shrink-0 min-w-[35px] min-h-[35px] w-[35px] h-[35px]"
          />
        </Link>

        <nav className="flex-1 px-3 mt-8 space-y-2">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-[10px] py-3 md:py-2.5 rounded-xl text-base transition whitespace-nowrap ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-800 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={22} strokeWidth={1.5} className="flex-shrink-0" />
                <span className="opacity-100 md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300 text-[14px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <div className="border-t border-gray-200 pt-3 space-y-2">
            {bottomItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-[10px] py-3 md:py-2.5 rounded-xl text-base transition whitespace-nowrap ${
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-800 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon size={22} strokeWidth={1.5} className="flex-shrink-0" />
                  <span className="opacity-100 md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300 text-[14px]">
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {user && (
              <div className="flex items-center px-[10px] py-2.5 rounded-xl">
                <div className="opacity-100 md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300 min-w-0 flex-1">
                  <div className="text-[14px] font-medium truncate">{displayName}</div>
                  <div className="text-[12px] text-gray-600 truncate">{email}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex-shrink-0 text-gray-500 hover:text-gray-900 transition disabled:opacity-50 cursor-pointer ml-3 md:ml-auto md:group-hover/sidebar:ml-3"
                >
                  <LogOut size={22} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
