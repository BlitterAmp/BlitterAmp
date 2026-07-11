import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import type { Client } from "../api/client";

/** Cover art via the authed client (plain <img src> can't send the bearer). */
export function AlbumArt({
  client,
  artId,
  size = 300,
  alt = "",
}: {
  client: Client;
  artId?: string | null;
  size?: number;
  alt?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSrc(null);
    if (artId) {
      client
        .loadArt(artId, size)
        .then((url) => {
          if (live) setSrc(url);
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [client, artId, size]);

  if (!src) {
    return (
      <div className="art-placeholder">
        <Music size={Math.min(40, size / 3)} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" draggable={false} />;
}
