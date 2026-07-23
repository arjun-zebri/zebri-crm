// Requires local Supabase (Docker). Deferred: not executed in the authoring session.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Integration test for _user_branding(uuid) social URL fields.
 *
 * Verifies that twitter_url, pinterest_url, and website_url (alias for website)
 * are correctly exposed in the branding RPC output when set in auth.users.raw_user_meta_data.
 */

interface BrandingResponse {
  twitter_url: string | null
  pinterest_url: string | null
  website_url: string | null
  website: string | null
  facebook_url: string | null
  instagram_url: string | null
  [key: string]: unknown
}

describe('_user_branding social URLs', () => {
  let supabase: ReturnType<typeof createClient<Database>>
  let testUserId: string

  beforeEach(async () => {
    // Use service role to set up test user with social URLs in metadata
    supabase = createClient<Database>(
      process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MCwiZXhwIjoyMzA1MzAwODAwfQ.IS5kTXAFjPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Create a test user via admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email: `test-social-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    })

    if (error) throw error
    testUserId = data.user.id

    // Update user metadata with social URLs in app_metadata-equivalent field.
    // The admin API uses app_metadata internally for raw_user_meta_data updates.
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      testUserId,
      {
        app_metadata: {
          twitter_url: 'https://twitter.com/testmc',
          pinterest_url: 'https://pinterest.com/testmc',
          website: 'https://testmc.com',
          business_name: 'Test MC',
          tagline: 'Your special day',
        },
      }
    )

    if (updateError) throw updateError
  })

  afterEach(async () => {
    // Clean up test user
    if (testUserId && supabase) {
      await supabase.auth.admin.deleteUser(testUserId)
    }
  })

  it('should expose twitter_url from raw_user_meta_data', async () => {
    const { data, error } = await supabase.rpc('_user_branding', {
      p_user_id: testUserId,
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    const branding = data as BrandingResponse
    expect(branding.twitter_url).toBe('https://twitter.com/testmc')
  })

  it('should expose pinterest_url from raw_user_meta_data', async () => {
    const { data, error } = await supabase.rpc('_user_branding', {
      p_user_id: testUserId,
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    const branding = data as BrandingResponse
    expect(branding.pinterest_url).toBe('https://pinterest.com/testmc')
  })

  it('should expose website_url as alias for website metadata key', async () => {
    const { data, error } = await supabase.rpc('_user_branding', {
      p_user_id: testUserId,
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    const branding = data as BrandingResponse
    expect(branding.website_url).toBe('https://testmc.com')
    // website key should also exist for back-compat
    expect(branding.website).toBe('https://testmc.com')
  })

  it('should return null for missing social URLs', async () => {
    // Create a user without social URLs set
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email: `test-no-social-${Date.now()}@example.com`,
        password: 'TestPassword123!',
      })

    if (createError) throw createError

    const userId = userData.user.id

    try {
      const { data, error } = await supabase.rpc('_user_branding', {
        p_user_id: userId,
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      const branding = data as BrandingResponse
      expect(branding.twitter_url).toBeNull()
      expect(branding.pinterest_url).toBeNull()
      // website_url should also be null if website is not set
      expect(branding.website_url).toBeNull()
    } finally {
      await supabase.auth.admin.deleteUser(userId)
    }
  })

  it('should include all three social URLs alongside existing facebook/instagram', async () => {
    // Update with all social URLs
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      testUserId,
      {
        app_metadata: {
          twitter_url: 'https://twitter.com/testmc',
          pinterest_url: 'https://pinterest.com/testmc',
          website: 'https://testmc.com',
          facebook_url: 'https://facebook.com/testmc',
          instagram_url: 'https://instagram.com/testmc',
        },
      }
    )

    if (updateError) throw updateError

    const { data, error } = await supabase.rpc('_user_branding', {
      p_user_id: testUserId,
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    const branding = data as BrandingResponse

    // All social URLs should be present
    expect(branding.twitter_url).toBe('https://twitter.com/testmc')
    expect(branding.pinterest_url).toBe('https://pinterest.com/testmc')
    expect(branding.website_url).toBe('https://testmc.com')
    expect(branding.facebook_url).toBe('https://facebook.com/testmc')
    expect(branding.instagram_url).toBe('https://instagram.com/testmc')
  })
})
