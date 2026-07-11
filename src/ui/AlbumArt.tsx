import { Music } from "lucide-react";
import { useEffect, useState } from "react";
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
        .then((url) => live && setSrc(url))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [client, artId, size]);

  if (!src) {
    return (
      <div className="flex size-full items-center justify-center bg-base-300 text-base-content/30">
        <Music size={Math.min(40, size / 3)} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" draggable={false} className="size-full object-cover" />;
}
