"use client";

import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Target,
  Contact,
  Settings,
  LogOut,
  Calendar,
  CheckSquare,
  CreditCard,
  Shield,
  ChevronLeft,
  ChevronRight,
  Paintbrush,
  Sparkles,
  FileStack,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import { clearShadowCookies } from "@/app/admin/actions";
import { isAdmin } from "@/lib/auth/entitlements";
import { createClient } from "@/lib/supabase/client";


const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Couples", href: "/couples?view=board", icon: Target },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Contacts", href: "/contacts", icon: Contact },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Automations", href: "/automations", icon: Sparkles },
  { label: "Templates", href: "/templates", icon: FileStack },
];

const bottomItems = [
  { label: "Branding", href: "/branding", icon: Paintbrush },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose = () => {}, isExpanded, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
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
    await clearShadowCookies();
    const supabase = createClient();
    await supabase.auth.signOut();
    queryClient.clear();
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
        className={`fixed top-0 left-0 h-screen w-[280px] ${isExpanded ? "md:w-60" : "md:w-[68px]"} border-r border-border bg-surface flex flex-col transition-all duration-300 ease-in-out z-50 overflow-visible ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Inner wrapper scrolls vertically when the viewport is shorter
            than the full nav + bottom block (e.g. iPhone SE + shadow
            banner). `min-w-0` keeps text from overflowing when collapsed.
            The scrollbar is hidden in every state (Firefox `scrollbar-width`,
            WebKit pseudo-element) so it never flashes mid-transition while
            the content stays scrollable. */}
        <div className="flex flex-col flex-1 overflow-y-auto min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/"
          onClick={onMobileClose}
          className="flex items-center hover:opacity-80 transition px-[16px] pt-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG icon, nothing for next/image to optimise */}
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
                className={`flex items-center gap-3 px-[10px] py-3 md:py-2.5 rounded-control text-base transition whitespace-nowrap ${
                  isActive
                    ? "bg-surface-emphasis text-text"
                    : "text-gray-800 hover:bg-gray-50 hover:text-text"
                }`}
              >
                <Icon size={18} strokeWidth={1.5} className="flex-shrink-0" />
                <span className={`opacity-100 ${isExpanded ? "md:opacity-100" : "md:opacity-0"} transition-opacity duration-300 text-body`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <div className="border-t border-border pt-3 space-y-2">
            {[
              ...bottomItems,
              // Admin link visibility goes through the entitlements
              // helper so it reads app_metadata only (§7.4): a user
              // writing account_type='admin' to user_metadata via
              // auth.updateUser({data}) cannot make the link appear.
              ...(isAdmin(user)
                ? [{ label: "Admin", href: "/admin", icon: Shield }]
                : []),
            ].map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-[10px] py-3 md:py-2.5 rounded-control text-base transition whitespace-nowrap ${
                    isActive
                      ? "bg-surface-emphasis text-text"
                      : "text-gray-800 hover:bg-gray-50 hover:text-text"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.5} className="flex-shrink-0" />
                  <span className={`opacity-100 ${isExpanded ? "md:opacity-100" : "md:opacity-0"} transition-opacity duration-300 text-body`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* TEMPORARY: dev-only branding-onboarding re-trigger. Clears the
                paint-hint cache and force-opens the wizard via ?onboarding=1.
                Never ships to production: the NODE_ENV check strips it from
                the build. Remove with the branding page's forceOnboarding
                branch once onboarding QA has a permanent home.

                HIDDEN: flip the `false &&` guard back to
                `process.env.NODE_ENV === "development" &&` to restore this. */}
            {false && process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("zebri:branding-onboarded");
                  window.location.href = "/branding?onboarding=1";
                }}
                className="w-full flex items-center gap-3 px-[10px] py-3 md:py-2.5 rounded-control text-base text-gray-800 hover:bg-gray-50 hover:text-text transition whitespace-nowrap cursor-pointer"
              >
                <RotateCcw size={18} strokeWidth={1.5} className="flex-shrink-0" />
                <span className={`opacity-100 ${isExpanded ? "md:opacity-100" : "md:opacity-0"} transition-opacity duration-300 text-body`}>
                  Replay onboarding
                </span>
              </button>
            )}

            {user && (
              <div className="border-t border-border mt-2 pt-2">
                <div className="flex items-center px-[10px] py-2.5">
                  <div className={`opacity-100 ${isExpanded ? "md:opacity-100" : "md:opacity-0"} transition-opacity duration-300 min-w-0 flex-1`}>
                    <div className="text-body font-medium truncate">{displayName}</div>
                    <div className="text-body text-gray-600 truncate">{email}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className={`flex-shrink-0 text-text-muted hover:text-text transition disabled:opacity-50 cursor-pointer ${isExpanded ? "ml-3" : "md:ml-auto ml-3"}`}
                  >
                    <LogOut size={18} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>{/* end inner clip wrapper */}

        <button
          onClick={onToggle}
          className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-3.5 z-10 items-center justify-center w-7 h-7 rounded-pill bg-surface border border-border text-text-subtle hover:text-gray-700 shadow-sm transition"
        >
          {isExpanded ? <ChevronLeft size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
        </button>
      </aside>
    </>
  );
}
