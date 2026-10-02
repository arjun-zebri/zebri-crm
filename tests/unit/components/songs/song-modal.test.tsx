/**
 * Behaviour tests for the MC song modal (client profile) and the shared
 * Spotify picker it uses: search, pick, preview, typed fallback, and what
 * gets saved in each case.
 *
 * @module tests/unit/components/songs/song-modal.test
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SongModal } from '@/app/(dashboard)/couples/song-modal';
import type { PortalSong } from '@/app/(dashboard)/couples/use-portal-data';

const TRACK = {
  id: '44AyOl4qVkzS48vBsbNXaC',
  title: "Can't Help Falling in Love",
  artist: 'Elvis Presley',
  album: 'Blue Hawaii',
  artworkUrl: 'https://i.scdn.co/image/abc123',
  durationMs: 182_000,
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ tracks: [TRACK] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function renderModal(song: PortalSong | null = null) {
  const onSave = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SongModal isOpen onClose={vi.fn()} onSave={onSave} song={song} categoryLabel="First Dance" saving={false} />
    </QueryClientProvider>,
  );
  return { onSave };
}

const typedSong: PortalSong = {
  id: 's1', category: 'first_dance', title: 'Live set', artist: 'Cousin Sam', notes: null, position: 0,
  spotify_track_id: null, artwork_url: null, duration_ms: null,
};

describe('SongModal', () => {
  it('searches Spotify, previews the pick, and saves the track', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(screen.getByLabelText('Search Spotify'), 'cant help');
    await user.click(await screen.findByRole('button', { name: /Can't Help Falling in Love/ }));

    expect(screen.getByTitle("Play Can't Help Falling in Love on Spotify")).toHaveAttribute(
      'src',
      `https://open.spotify.com/embed/track/${TRACK.id}`,
    );
    const searched = new URL(String(fetchMock.mock.calls.at(-1)![0]), 'http://x');
    expect(searched.searchParams.get('q')).toBe('cant help');
    expect(searched.searchParams.has('portal_token')).toBe(false);

    await user.type(screen.getByLabelText('Notes'), 'From the chorus');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
      title: TRACK.title,
      artist: 'Elvis Presley',
      notes: 'From the chorus',
      spotify_track_id: TRACK.id,
      artwork_url: TRACK.artworkUrl,
      duration_ms: 182_000,
    });
  });

  it('says so when Spotify has no match', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ tracks: [] }), { status: 200 }));
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText('Search Spotify'), 'zzzz');
    expect(await screen.findByText('No matches on Spotify.')).toBeInTheDocument();
  });

  it('offers typing the song in when Spotify search is down', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    const user = userEvent.setup();
    const { onSave } = renderModal();
    await user.type(screen.getByLabelText('Search Spotify'), 'perfect');
    expect(await screen.findByText(/isn't available right now/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Type it in/ }));
    await user.type(screen.getByLabelText('Song title'), 'Perfect');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
      title: 'Perfect', artist: null, notes: null,
      spotify_track_id: null, artwork_url: null, duration_ms: null,
    });
  });

  it('opens an existing typed song in typed mode', () => {
    renderModal(typedSong);
    expect(screen.getByLabelText('Song title')).toHaveValue('Live set');
    expect(screen.getByLabelText('Artist')).toHaveValue('Cousin Sam');
  });

  it('opens an existing picked song with its player showing', () => {
    renderModal({ ...typedSong, title: TRACK.title, spotify_track_id: TRACK.id, artwork_url: TRACK.artworkUrl, duration_ms: 182_000 });
    expect(screen.getByTitle(`Play ${TRACK.title} on Spotify`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('looks a pasted Spotify link up straight away', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByLabelText('Search Spotify'));
    await user.paste(`https://open.spotify.com/track/${TRACK.id}?si=abc`);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(new URL(String(fetchMock.mock.calls[0]![0]), 'http://x').searchParams.get('q')).toContain(TRACK.id);
  });
});
