import { Button } from '@/components/ui-v2/button';

/**
 * Any sidebar page on a new account other than Home: the page's title
 * and one calm line saying it fills up as the MC works, with the way
 * back to Home. Never demo rows: an empty account that shows
 * made-up clients reads as someone else's account.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/empty-page
 */
export function EmptyPage({
  title,
  heading: Heading,
  onHome,
}: {
  title: string;
  heading: 'h1' | 'h2';
  onHome: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col px-4 pb-10 pt-4 md:px-6 md:pt-5">
      <Heading className="type-title text-zebra-950">{title}</Heading>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="type-subheading text-zebra-950">Nothing here yet</p>
        <p className="max-w-sm text-balance type-body text-zebra-500">
          {title} fills up as you work. Home walks you through your first client.
        </p>
        <Button variant="secondary" onClick={onHome} className="mt-2">
          Back to Home
        </Button>
      </div>
    </div>
  );
}
