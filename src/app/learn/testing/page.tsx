import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "testing";

export const metadata = trackMetadata(TRACK);

export default function TestingPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
