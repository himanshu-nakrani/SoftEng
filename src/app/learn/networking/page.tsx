import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "networking";

export const metadata = trackMetadata(TRACK);

export default function NetworkingPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
