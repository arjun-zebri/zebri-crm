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
  PlayCircle,
  FileStack,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import { WELCOME_REPLAY_EVENT } from "@/app/(dashboard)/onboarding/welcome-modal";
import { clearShadowCookies } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
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
  // Docs lives on the marketing site, so it navigates out of the app
  // (rendered as a plain anchor rather than a client-side <Link>).
  { label: "Docs", href: "https://zebri.com.au/docs", icon: BookOpen, external: true },
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
        className={`fixed top-0 left-0 h-screen w-[280px] ${isExpanded ? "md:w-60" : "md:w-[68px]"} border-r border-gray-200 bg-white flex flex-col transition-all duration-300 ease-in-out z-50 overflow-visible ${
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
                <Icon size={18} strokeWidth={1.5} className="flex-shrink-0" />
                <span className={`opacity-100 ${isExpanded ? "md:opacity-100" : "md:opacity-0"} transition-opacity duration-300 text-[13px]`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <div className="border-t border-gray-200 pt-3 space-y-2">
            {/* Temporary testing control (2026-07-23): replays the welcome
                wizard on demand so it can be exercised without a fresh
                account. Remove with WELCOME_REPLAY_EVENT before release. */}
            <Button
              variant="ghost"
              onClick={() =>
                window.dispatchEvent(new Event(WELCOME_REPLAY_EVENT))
              }
              className="w-full justify-start gap-3 px-[10px] py-3 md:py-2.5 rounded-xl text-gray-800 hover:bg-gray-50 hover:text-gray-900 font-normal"
            >
              <PlayCircle size={18} strokeWidth={1.5} className="flex-shrink-0" />
              <span className={`opacity-100 ${isExpanded ? "md:opacity-100" : "md:opacity-0"} transition-opacity duration-300 text-[13px]`}>
                Welcome tour
              </span>
            </Button>
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
              const external = "external" in item && item.external;
              // External items (e.g. Docs) never reflect app routes, so
              // they're never the active item.
              const isActive = !external && pathname.startsWith(item.href);
              const Icon = item.icon;
              const className = `flex items-center gap-3 px-[10px] py-3 md:py-2.5 rounded-xl text-base transition whitespace-nowrap ${
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-800 hover:bg-gray-50 hover:text-gray-900"
              }`;
              const inner = (
                <>
                  <Icon size={18} strokeWidth={1.5} className="flex-shrink-0" />
                  <span className={`opacity-100 ${isExpanded ? "md:opacity-100" : "md:opacity-0"} transition-opacity duration-300 text-[13px]`}>
                    {item.label}
                  </span>
                </>
              );

              return external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onMobileClose}
                  className={className}
                >
                  {inner}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  className={className}
                >
                  {inner}
                </Link>
              );
            })}

            {user && (
              <div className="border-t border-gray-200 mt-2 pt-2">
                <div className="flex items-center px-[10px] py-2.5">
                  <div className={`opacity-100 ${isExpanded ? "md:opacity-100" : "md:opacity-0"} transition-opacity duration-300 min-w-0 flex-1`}>
                    <div className="text-[13px] font-medium truncate">{displayName}</div>
                    <div className="text-[11px] text-gray-600 truncate">{email}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className={`flex-shrink-0 text-gray-500 hover:text-gray-900 transition disabled:opacity-50 cursor-pointer ${isExpanded ? "ml-3" : "md:ml-auto ml-3"}`}
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
          className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-3.5 z-10 items-center justify-center w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 shadow-sm transition"
        >
          {isExpanded ? <ChevronLeft size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
        </button>
      </aside>
    </>
  );
}
