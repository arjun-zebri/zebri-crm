/**
 * The songs the preview's song search finds: a stand-in for the Spotify
 * search the current app already has, which this question type uses
 * when it ships. A mix of the songs MCs are asked for most (entrances,
 * first dances, the last song of the night).
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/fields/song-list
 */

export interface Song {
  title: string;
  artist: string;
  /** A tint for the cover square, from the song's mood. */
  tone: 'grass' | 'champagne' | 'zebra';
}

export const SONGS: Song[] = [
  { title: 'Perfect', artist: 'Ed Sheeran', tone: 'champagne' },
  { title: 'Thinking Out Loud', artist: 'Ed Sheeran', tone: 'champagne' },
  { title: 'At Last', artist: 'Etta James', tone: 'zebra' },
  { title: 'Signed, Sealed, Delivered', artist: 'Stevie Wonder', tone: 'zebra' },
  { title: 'Mr. Blue Sky', artist: 'Electric Light Orchestra', tone: 'zebra' },
  { title: 'Happy', artist: 'Pharrell Williams', tone: 'grass' },
  { title: 'Can’t Help Falling in Love', artist: 'Elvis Presley', tone: 'zebra' },
  { title: 'A Thousand Years', artist: 'Christina Perri', tone: 'champagne' },
  { title: 'All of Me', artist: 'John Legend', tone: 'zebra' },
  { title: 'Marry You', artist: 'Bruno Mars', tone: 'grass' },
  { title: 'September', artist: 'Earth, Wind & Fire', tone: 'grass' },
  { title: 'Dancing Queen', artist: 'ABBA', tone: 'zebra' },
  { title: 'You Make My Dreams', artist: 'Daryl Hall & John Oates', tone: 'zebra' },
  { title: 'Lovely Day', artist: 'Bill Withers', tone: 'grass' },
  { title: 'Make You Feel My Love', artist: 'Adele', tone: 'zebra' },
  { title: 'Here Comes the Sun', artist: 'The Beatles', tone: 'champagne' },
  { title: 'Shut Up and Dance', artist: 'WALK THE MOON', tone: 'zebra' },
  { title: 'Tum Hi Ho', artist: 'Arijit Singh', tone: 'champagne' },
];

/** A song as an answer reads: "Perfect, Ed Sheeran". */
export const songText = (s: Song) => `${s.title}, ${s.artist}`;

/** The songs matching what was typed, by title or artist, best first. */
export function findSongs(query: string): Song[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SONGS.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.title.toLowerCase().startsWith(q)) - Number(!b.title.toLowerCase().startsWith(q)))
    .slice(0, 6);
}
