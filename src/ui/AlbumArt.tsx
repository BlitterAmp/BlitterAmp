import { invoke } from "@tauri-apps/api/core";
import { Music } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { subscribeLibraryChanges } from "../state/library";
import { ArtUrlCache } from "./artUrlCache";

// Cover art from the Rust host's persistent on-disk cache (keyed by art id,
// fetched once from the server then served locally forever). Loads only when
// scrolled into view (IntersectionObserver) so kept-alive/off-screen grids
// don't fetch thousands of images up front. Object URLs are memoized per
// art+size so re-renders don't re-decode.
const urls = new ArtUrlCache(400, 120_000, (url) => URL.revokeObjectURL(url));
subscribeLibraryChanges(() => urls.invalidateNegatives());

function artUrl(artId: string, size: number): Promise<string> {
  const key = `${artId}@${size}`;
  return urls.get(key, () =>
    invoke<ArrayBuffer>("library_art", { artId, size }).then(
      (bytes) => URL.createObjectURL(new Blob([bytes])),
    ),
  );
}

export function AlbumArt({
  artId,
  size = 300,
  alt = "",
}: {
  artId?: string | null;
  size?: number;
  alt?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    let live = true;
    setSrc(null);
    if (visible && artId) {
      artUrl(artId, size)
        .then((url) => live && setSrc(url))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [visible, artId, size]);

  return (
    <div ref={ref} className="size-full">
      {src ? (
        <img src={src} alt={alt} loading="lazy" draggable={false} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center bg-base-300 text-base-content/30">
          <Music size={Math.min(40, size / 3)} />
        </div>
      )}
    </div>
  );
}
