import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { PersonalInfoSection } from '@/app/(dashboard)/settings/personal-info-section'
import * as supabaseModule from '@/lib/supabase/client'

// Mock the supabase client and toast
vi.mock('@/lib/supabase/client')
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe('PersonalInfoSection social settings', () => {
  let mockUpdateUser: ReturnType<typeof vi.fn>
  let mockGetUser: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockUpdateUser = vi.fn().mockResolvedValue({ error: null })
    mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { user_metadata: {} } },
    })

    const mockCreateClient = vi.fn(() => ({
      auth: {
        getUser: mockGetUser,
        updateUser: mockUpdateUser,
      },
    })) as ReturnType<typeof vi.fn>

    vi.mocked(supabaseModule.createClient).mockImplementation(mockCreateClient as any)
  })

  it('persists twitter_url and pinterest_url to auth.updateUser', async () => {
    const user = userEvent.setup({ delay: null })

    render(
      <PersonalInfoSection
        initialData={{
          displayName: 'John Doe',
          businessName: 'Test Business',
          phone: '+61 400 000 000',
          website: 'https://example.com',
          instagramUrl: 'https://instagram.com/test',
          facebookUrl: 'https://facebook.com/test',
          twitterUrl: '',
          pinterestUrl: '',
          businessType: 'mc',
          mcSignatureName: 'John Doe',
          addressText: 'Sydney, NSW',
          addressLat: -33.8688,
          addressLng: 151.2093,
        }}
        email="test@example.com"
      />,
    )

    // Find the Twitter input field
    const twitterInput = screen.getByPlaceholderText('https://twitter.com/yourhandle')
    expect(twitterInput).toBeInTheDocument()

    // Find the Pinterest input field
    const pinterestInput = screen.getByPlaceholderText('https://pinterest.com/yourprofile')
    expect(pinterestInput).toBeInTheDocument()

    // Set Twitter URL
    await user.type(twitterInput, 'https://twitter.com/testhandle')

    // Set Pinterest URL
    await user.type(pinterestInput, 'https://pinterest.com/testprofile')

    // Trigger blur on the pinterest input to trigger autoSave
    fireEvent.blur(pinterestInput)

    // Wait for the updateUser to be called with the new values
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled()
    }, { timeout: 1000 })

    // Get the most recent call (in case there were multiple calls)
    const lastCall = mockUpdateUser.mock.calls.length - 1
    const updateUserCall = mockUpdateUser.mock.calls[lastCall]![0]
    expect(updateUserCall.data.twitter_url).toBe('https://twitter.com/testhandle')
    expect(updateUserCall.data.pinterest_url).toBe('https://pinterest.com/testprofile')
  })

  it('renders twitter and pinterest input fields with correct labels and placeholders', () => {
    render(
      <PersonalInfoSection
        initialData={{
          displayName: 'John Doe',
          businessName: 'Test Business',
          phone: '+61 400 000 000',
          website: 'https://example.com',
          instagramUrl: 'https://instagram.com/test',
          facebookUrl: 'https://facebook.com/test',
          twitterUrl: 'https://twitter.com/existing',
          pinterestUrl: 'https://pinterest.com/existing',
          businessType: 'mc',
          mcSignatureName: 'John Doe',
          addressText: 'Sydney, NSW',
          addressLat: -33.8688,
          addressLng: 151.2093,
        }}
        email="test@example.com"
      />,
    )

    // Check Twitter field
    const twitterLabel = screen.getByText('Twitter')
    const twitterInput = screen.getByPlaceholderText('https://twitter.com/yourhandle') as HTMLInputElement
    expect(twitterLabel).toBeInTheDocument()
    expect(twitterInput).toBeInTheDocument()
    expect(twitterInput.value).toBe('https://twitter.com/existing')

    // Check Pinterest field
    const pinterestLabel = screen.getByText('Pinterest')
    const pinterestInput = screen.getByPlaceholderText('https://pinterest.com/yourprofile') as HTMLInputElement
    expect(pinterestLabel).toBeInTheDocument()
    expect(pinterestInput).toBeInTheDocument()
    expect(pinterestInput.value).toBe('https://pinterest.com/existing')
  })

  it('detects changes to twitter_url and pinterest_url as dirty state', async () => {
    const user = userEvent.setup()

    const { rerender } = render(
      <PersonalInfoSection
        initialData={{
          displayName: 'John Doe',
          businessName: 'Test Business',
          phone: '+61 400 000 000',
          website: 'https://example.com',
          instagramUrl: 'https://instagram.com/test',
          facebookUrl: 'https://facebook.com/test',
          twitterUrl: 'https://twitter.com/old',
          pinterestUrl: 'https://pinterest.com/old',
          businessType: 'mc',
          mcSignatureName: 'John Doe',
          addressText: 'Sydney, NSW',
          addressLat: -33.8688,
          addressLng: 151.2093,
        }}
        email="test@example.com"
      />,
    )

    const twitterInput = screen.getByPlaceholderText('https://twitter.com/yourhandle')
    await user.click(twitterInput)
    await user.clear(twitterInput)
    await user.type(twitterInput, 'https://twitter.com/new')

    // Blur should trigger save
    fireEvent.blur(twitterInput)

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            twitter_url: 'https://twitter.com/new',
          }),
        }),
      )
    })
  })
})
