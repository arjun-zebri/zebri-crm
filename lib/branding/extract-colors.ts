export async function extractColorsFromFile(file: File, count = 3): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode image'))
      img.onload = () => {
        try {
          resolve(extractColorsFromImage(img, count))
        } catch (e) {
          reject(e)
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function extractColorsFromImage(img: HTMLImageElement, count: number): string[] {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const buckets = new Map<string, number>()
  for (let i = 0; i < data.length; i += 4) {
    // `data` indexing is `number | undefined` under noUncheckedIndexedAccess;
    // an out-of-range read falls back to 0 (skipped as fully transparent).
    const a = data[i + 3] ?? 0
    if (a < 200) continue
    const r = ((data[i] ?? 0) >> 4) << 4
    const g = ((data[i + 1] ?? 0) >> 4) << 4
    const b = ((data[i + 2] ?? 0) >> 4) << 4
    const avg = (r + g + b) / 3
    if (avg > 235 || avg < 20) continue
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max - min < 20) continue
    const key = `${r},${g},${b}`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }

  const sorted = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => {
      // Keys are self-authored `r,g,b` triples; defaults keep the channels
      // typed as `number` rather than `number | undefined`.
      const [r = 0, g = 0, b = 0] = key.split(',').map(Number)
      return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')
    })

  const distinct: string[] = []
  for (const c of sorted) {
    if (distinct.length === count) break
    if (distinct.every(d => colorDistance(d, c) > 40)) distinct.push(c)
  }
  return distinct
}

function colorDistance(a: string, b: string): number {
  const ar = parseInt(a.slice(1, 3), 16),
    ag = parseInt(a.slice(3, 5), 16),
    ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16),
    bg = parseInt(b.slice(3, 5), 16),
    bb = parseInt(b.slice(5, 7), 16)
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2)
}
