import Image from "next/image";
import { createServerClient } from "@supabase/ssr";
import { PublicTimelineItem } from "./timeline-item";

interface MC {
  business_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
}

interface TimelineData {
  date: string;
  venue: string;
  couple: { name: string };
  mc: MC;
  timeline_items: Array<{
    id: string;
    start_time: string | null;
    title: string;
    description: string | null;
    duration_min: number | null;
    position: number;
    contact: { name: string; category: string } | null;
  }>;
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PublicTimelinePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );

  const { data } = await supabase.rpc("get_public_timeline", { token });
  const timeline = data as TimelineData | null;

  if (!timeline) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 gap-6">
        <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} />
        <p className="text-sm text-gray-500">
          This timeline is no longer available.
        </p>
      </div>
    );
  }

  const { mc } = timeline;
  const mcName = mc.business_name || mc.display_name;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        {/* Logo */}
        <div className="pt-10 pb-2">
          <Image src="/zebri-logo.svg" alt="Zebri" width={64} height={23} />
        </div>

        {/* Event header */}
        <div className="pt-8 pb-8 border-b border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            {timeline.couple.name}
          </h1>
          <p className="text-sm text-gray-500">
            {timeline.date ? formatEventDate(timeline.date) : ""}
            {timeline.date && timeline.venue ? " · " : ""}
            {timeline.venue}
          </p>
        </div>

        {/* Timeline items */}
        <div className="pt-8">
          {!timeline.timeline_items || timeline.timeline_items.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No items added yet.</p>
          ) : (
            timeline.timeline_items
              .filter((item) => item.start_time)
              .map((item) => (
                <PublicTimelineItem
                  key={item.id}
                  time={item.start_time}
                  title={item.title}
                  description={item.description}
                  duration_min={item.duration_min}
                  contact={item.contact}
                />
              ))
          )}
        </div>

        {/* MC contact footer */}
        <div className="border-t border-gray-100 mt-12 pt-8 pb-4">
          {mcName && (
            <p className="text-sm font-medium text-gray-900 mb-1">{mcName}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {mc.email && (
              <a
                href={`mailto:${mc.email}`}
                className="text-sm text-gray-500 hover:text-gray-700 transition"
              >
                {mc.email}
              </a>
            )}
            {mc.phone && (
              <a
                href={`tel:${mc.phone}`}
                className="text-sm text-gray-500 hover:text-gray-700 transition"
              >
                {mc.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
