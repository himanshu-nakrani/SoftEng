import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "operating-systems";

export const metadata = trackMetadata(TRACK);

export default function OperatingSystemsPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
