import { CoupleFormPage } from '../../pages/dashboard/bdm/couple-form-page';

/**
 * The couple's marriage details form on a page of its own (dev-only, via
 * the showroom layout), opened in a new tab by See what they see in the
 * paperwork dialog. The client comes from the address.
 *
 * @module app/design-system/v2/couple-form/[client]/page
 */
export default async function CoupleFormRoute({ params }: { params: Promise<{ client: string }> }) {
  const { client } = await params;
  return <CoupleFormPage client={decodeURIComponent(client)} />;
}
