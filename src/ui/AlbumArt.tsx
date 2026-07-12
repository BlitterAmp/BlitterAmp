import { invoke } from "@tauri-apps/api/core";
import { Music } from "lucide-react";
import { useEffect, useState } from "react";

// Cover art from the Rust host's persistent on-disk cache (keyed by art id,
// fetched once from the server then served locally forever). Object URLs are
// memoized per art+size so re-renders don't re-decode.
const urls = new Map<string, Promise<string>>();

function artUrl(artId: string, size: number): Promise<string> {
  const key = `${artId}@${size}`;
  let p = urls.get(key);
  if (!p) {
    p = invoke<number[]>("library_art", { artId, size }).then(
      (bytes) => URL.createObjectURL(new Blob([new Uint8Array(bytes)])),
    );
    p.catch(() => urls.delete(key));
    urls.set(key, p);
  }
  return p;
}

// `client` is accepted but unused — art no longer goes through the HTTP client.
export function AlbumArt({
  artId,
  size = 300,
  alt = "",
}: {
  client?: unknown;
  artId?: string | null;
  size?: number;
  alt?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSrc(null);
    if (artId) {
      artUrl(artId, size)
        .then((url) => live && setSrc(url))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [artId, size]);

  if (!src) {
    return (
      <div className="flex size-full items-center justify-center bg-base-300 text-base-content/30">
        <Music size={Math.min(40, size / 3)} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" draggable={false} className="size-full object-cover" />;
}
