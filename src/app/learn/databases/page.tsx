import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "databases";

export const metadata = trackMetadata(TRACK);

export default function DatabasesPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
