/**
 * AudioPlayButton tests.
 *
 * The bug this component replaced: every call site called `.play()` on
 * a hidden `<audio>` looked up by id and tracked no state, so the user
 * got no signal that a clip was playing. These tests pin the playing
 * state, the stop-and-rewind behaviour, and the fact that state follows
 * the media element's events rather than the click.
 *
 * @module tests/unit/components/ui/audio-play-button.test
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, vi } from 'vitest';

import { AudioPlayButton } from '@/components/ui/audio-play-button';

// jsdom has no media pipeline: play()/pause() are unimplemented, so
// stand them in with the events a real element would emit.
beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('pause'));
  });
});

describe('AudioPlayButton', () => {
  it('swaps the label to the playing state once playback starts', async () => {
    const user = userEvent.setup();
    render(<AudioPlayButton src="https://cdn.test/name.webm" label="Play" />);

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Playing')).toBeInTheDocument();
  });

  it('stops and rewinds on a second click', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AudioPlayButton src="https://cdn.test/name.webm" label="Play" />,
    );
    const audio = container.querySelector('audio') as HTMLAudioElement;

    await user.click(screen.getByRole('button'));
    audio.currentTime = 3;
    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Play')).toBeInTheDocument();
    // Rewound, so the next click replays the name from the start.
    expect(audio.currentTime).toBe(0);
  });

  it('returns to the resting state when the clip ends on its own', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AudioPlayButton src="https://cdn.test/name.webm" label="Play" />,
    );
    const audio = container.querySelector('audio') as HTMLAudioElement;

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Playing')).toBeInTheDocument();

    act(() => {
      audio.dispatchEvent(new Event('ended'));
    });
    expect(screen.getByText('Play')).toBeInTheDocument();
  });

  it('applies the playing tone instead of the resting one', async () => {
    const user = userEvent.setup();
    render(
      <AudioPlayButton
        src="https://cdn.test/name.webm"
        label="Play"
        idleClassName="text-emerald-600"
        playingClassName="text-emerald-700"
      />,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-emerald-600');

    await user.click(button);

    expect(button).toHaveClass('text-emerald-700');
    expect(button).not.toHaveClass('text-emerald-600');
  });

  it('names the icon-only variant for assistive tech', () => {
    render(<AudioPlayButton src="https://cdn.test/name.webm" title="Play pronunciation" />);
    expect(screen.getByRole('button', { name: 'Play pronunciation' })).toBeInTheDocument();
  });
});
