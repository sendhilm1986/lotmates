const PHOTOS = {
  Health: ['photo-1639772823849-6efbd173043c', 'photo-1615461066159-fea0960485d5'],
  Cleaning: ['photo-1686178827149-6d55c72d81df', 'photo-1740657254989-42fe9c3b8cce'],
  Solar: ['photo-1613665813446-82a78c468a1d', 'photo-1658298775754-5839ffd434cc'],
  Products: ['photo-1586208958839-06c17cacdf08', 'photo-1484154218962-a197022b5858'],
  Pest: ['photo-1747659629851-a92bd71149f6', 'photo-1581578017093-cd30fce4eeb7'],
  AC: ['photo-1718203862467-c33159fdc504', 'photo-1700124113583-81aa99ea2aa2'],
};

function pickIndex(seed, length) {
  if (!seed || length < 2) return 0;
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % length;
}

export function dealPhoto(category, width = 800, seed = null) {
  const list = PHOTOS[category] ?? PHOTOS.Cleaning;
  const id = list[pickIndex(seed, list.length)];
  const height = Math.round((width * 9) / 16);
  return `https://images.unsplash.com/${id}?w=${width}&h=${height}&fit=crop&auto=format&q=70`;
}

const unsplash = (id, width) => `https://images.unsplash.com/${id}?w=${width}&h=${Math.round((width * 9) / 16)}&fit=crop&auto=format&q=70`;

/**
 * Every photo for a deal, cover first. Uploaded photos win; a deal without any falls back
 * to the category's stock photos so nothing ever shows an empty frame.
 */
export function dealGallery(deal) {
  const own = Array.isArray(deal?.gallery_c) ? deal.gallery_c.filter((g) => g?.full) : [];
  if (own.length) {
    return own.map((g) => ({
      key: String(g.id),
      large: g.large || g.full,
      medium: g.medium || g.large || g.full,
      thumb: g.thumb || g.medium || g.full,
      caption: g.caption || '',
      own: true,
    }));
  }
  const list = PHOTOS[deal?.category_c] ?? PHOTOS.Cleaning;
  const first = pickIndex(deal?.Id, list.length);
  const ordered = [...list.slice(first), ...list.slice(0, first)];
  return ordered.map((id) => ({ key: id, large: unsplash(id, 1400), medium: unsplash(id, 760), thumb: unsplash(id, 240), caption: '', own: false }));
}

/** The cover photo at roughly the width asked for. */
export function dealCover(deal, width = 800) {
  const g = dealGallery(deal)[0];
  if (!g) return dealPhoto(deal?.category_c, width, deal?.Id);
  if (!g.own) return dealPhoto(deal?.category_c, width, deal?.Id);
  return width <= 300 ? g.thumb : width <= 800 ? g.medium : g.large;
}

/** A YouTube or Vimeo link, understood. Returns null for anything else. */
export function parseVideo(url) {
  const u = String(url ?? '').trim();
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) {
    return {
      provider: 'youtube',
      id: m[1],
      embed: (autoplay) => `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1&playsinline=1${autoplay ? '&autoplay=1' : ''}`,
      poster: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`,
    };
  }
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  if (m) {
    return { provider: 'vimeo', id: m[1], embed: (autoplay) => `https://player.vimeo.com/video/${m[1]}?dnt=1&title=0&byline=0${autoplay ? '&autoplay=1' : ''}`, poster: null };
  }
  return null;
}

/** Photos plus the optional video, which sits right after the cover. */
export function dealMediaItems(deal) {
  const photos = dealGallery(deal);
  const video = parseVideo(deal?.video_c);
  if (!video) return photos;
  const cover = photos[0];
  const item = {
    key: `video-${video.id}`,
    video,
    large: video.poster || cover?.large,
    medium: video.poster || cover?.medium,
    thumb: video.poster || cover?.thumb,
    caption: 'Watch how the service works',
  };
  return [photos[0], item, ...photos.slice(1)].filter(Boolean);
}
