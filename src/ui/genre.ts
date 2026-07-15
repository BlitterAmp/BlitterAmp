export function genreDisplayName(genre: string): string {
  return genre
    .toLocaleLowerCase()
    .replace(/(^|[\s/&+-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase());
}
