import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "security";

export const metadata = trackMetadata(TRACK);

export default function SecurityPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
