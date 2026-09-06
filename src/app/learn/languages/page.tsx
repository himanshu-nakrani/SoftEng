import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "languages";

export const metadata = trackMetadata(TRACK);

export default function LanguagesPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
