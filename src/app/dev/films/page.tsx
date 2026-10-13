// DEV ONLY — every cinematic back to back, for screen checks (recorded to video for the designer). Production: 404.
import { notFound } from "next/navigation";
import { FilmReel } from "./reel";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <FilmReel />;
}
