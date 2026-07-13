import type { ArtistCredit } from "../api/client";

/** Renders the server's ordered credit exactly while keeping every artist navigable. */
export function ArtistCredits({
  credits,
  onOpenArtist,
  className = "",
}: {
  credits: ArtistCredit[];
  onOpenArtist: (artistId: string) => void;
  className?: string;
}) {
  return (
    <span className={className}>
      {credits.map((credit, index) => (
        <span key={`${credit.artistId}-${index}`}>
          <button
            type="button"
            className="hover:text-primary hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onOpenArtist(credit.artistId);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {credit.name}
          </button>
          {credit.joinPhrase}
        </span>
      ))}
    </span>
  );
}
