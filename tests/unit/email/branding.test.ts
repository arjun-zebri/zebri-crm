/**
 * Tests for email branding integration.
 *
 * Verifies that emails render with sender branding when provided, and
 * render byte-for-byte identically to today when branding is absent.
 *
 * @module tests/unit/email/branding
 */

import { describe, it, expect } from 'vitest';

import { resolveProposalLabels } from '@/lib/branding/proposal-labels';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { invoiceHtml } from '@/lib/email/html';

describe('Email branding', () => {
  const sampleInvoiceOpts = {
    coupleName: 'Smith & Jones',
    invoiceNumber: 'INV-2026-001',
    invoiceTitle: 'Wedding MC Services',
    dueDate: '15 August 2026',
    shareUrl: 'https://app.example.com/invoice/abc123',
    mcBusinessName: 'DJ Premier Events',
  };

  it('renders invoice without branding byte-for-byte identically to current output', () => {
    const html = invoiceHtml(sampleInvoiceOpts);

    // Snapshot captures the exact current output when no branding is passed.
    // If this snapshot breaks, you changed the no-branding HTML structure —
    // the back-compat requirement means it should NOT change.
    expect(html).toMatchSnapshot('invoice-no-branding');

    // Sanity checks: the output is a complete HTML document with expected elements.
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('INV-2026-001');
    expect(html).toContain('Wedding MC Services');
    expect(html).toContain('Smith & Jones');
    expect(html).toContain('https://app.example.com/invoice/abc123');
  });

  it('renders invoice with branding, containing brand hex and logo', () => {
    const branding: PublicBranding = {
      logo_url: 'https://cdn.example.com/logo.png',
      favicon_url: null,
      header_image_url: null,
      brand_color: '#d63031',
      accent_color: '#fd79a8',
      surface_color: '#ffffff',
      text_color: '#2d3436',
      muted_color: '#636e72',
      secondary_color: '#ffffff',
      secondary_text_color: '#374151',
      business_name: 'DJ Premier Events',
      tagline: null,
      abn: null,
      phone: null,
      website: null,
      instagram_url: null,
      facebook_url: null,
      show_contact_on_documents: true,
      font_heading: 'poppins',
      font_body: 'inter',
      font_weight: 600,
      font_body_weight: 400,
      font_scale: 1,
      density: 'cozy',
      corner_radius: 16,
      doc_padding: 0,
      proposal_labels: resolveProposalLabels({}),
      theme_preset: 'custom',
      email_show_logo: true,
      email_logo_align: 'left',
      email_show_accent: true,
      heading_size: 32,
      body_size: 15,
      heading_case: 'none',
      body_case: 'none',
      heading_letter_spacing: 0,
      body_line_height: 1.5,
      link_color: '#d63031',
      button_variant: 'fill',
      button_size: 'md',
      button_radius: 8,
      section_spacing: 32,
      page_background: '#ffffff',
    };

    const html = invoiceHtml(sampleInvoiceOpts, branding);

    // The output should contain the brand hex color.
    expect(html).toContain('#d63031');

    // The output should contain the logo URL.
    expect(html).toContain('https://cdn.example.com/logo.png');

    // The output is still a complete HTML document.
    expect(html).toContain('<!DOCTYPE html>');

    // Verify it doesn't break the content.
    expect(html).toContain('INV-2026-001');
    expect(html).toContain('Wedding MC Services');
  });

  it('renders invoice with branding with logo alignment center', () => {
    const branding: PublicBranding = {
      logo_url: 'https://cdn.example.com/logo.png',
      favicon_url: null,
      header_image_url: null,
      brand_color: '#d63031',
      accent_color: '#fd79a8',
      surface_color: '#ffffff',
      text_color: '#2d3436',
      muted_color: '#636e72',
      secondary_color: '#ffffff',
      secondary_text_color: '#374151',
      business_name: 'DJ Premier Events',
      tagline: null,
      abn: null,
      phone: null,
      website: null,
      instagram_url: null,
      facebook_url: null,
      show_contact_on_documents: true,
      font_heading: 'poppins',
      font_body: 'inter',
      font_weight: 600,
      font_body_weight: 400,
      font_scale: 1,
      density: 'cozy',
      corner_radius: 16,
      doc_padding: 0,
      proposal_labels: resolveProposalLabels({}),
      theme_preset: 'custom',
      email_show_logo: true,
      email_logo_align: 'center',
      email_show_accent: true,
      heading_size: 32,
      body_size: 15,
      heading_case: 'none',
      body_case: 'none',
      heading_letter_spacing: 0,
      body_line_height: 1.5,
      link_color: '#d63031',
      button_variant: 'fill',
      button_size: 'md',
      button_radius: 8,
      section_spacing: 32,
      page_background: '#ffffff',
    };

    const html = invoiceHtml(sampleInvoiceOpts, branding);

    // Should contain center alignment in the logo img tag.
    expect(html).toContain('align="center"');
    expect(html).toContain('margin:0 auto;');
  });

  it('renders invoice with branding but no logo shows business name wordmark', () => {
    const branding: PublicBranding = {
      logo_url: null,
      favicon_url: null,
      header_image_url: null,
      brand_color: '#d63031',
      accent_color: '#fd79a8',
      surface_color: '#ffffff',
      text_color: '#2d3436',
      muted_color: '#636e72',
      secondary_color: '#ffffff',
      secondary_text_color: '#374151',
      business_name: 'DJ Premier Events',
      tagline: null,
      abn: null,
      phone: null,
      website: null,
      instagram_url: null,
      facebook_url: null,
      show_contact_on_documents: true,
      font_heading: 'poppins',
      font_body: 'inter',
      font_weight: 600,
      font_body_weight: 400,
      font_scale: 1,
      density: 'cozy',
      corner_radius: 16,
      doc_padding: 0,
      proposal_labels: resolveProposalLabels({}),
      theme_preset: 'custom',
      email_show_logo: true,
      email_logo_align: 'left',
      email_show_accent: true,
      heading_size: 32,
      body_size: 15,
      heading_case: 'none',
      body_case: 'none',
      heading_letter_spacing: 0,
      body_line_height: 1.5,
      link_color: '#d63031',
      button_variant: 'fill',
      button_size: 'md',
      button_radius: 8,
      section_spacing: 32,
      page_background: '#ffffff',
    };

    const html = invoiceHtml(sampleInvoiceOpts, branding);

    // Should contain the business name as wordmark (in text, not img).
    expect(html).toContain('DJ Premier Events');

    // Should contain brand color for styling.
    expect(html).toContain('#d63031');
  });
});
