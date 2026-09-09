import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "version-control";

export const metadata = trackMetadata(TRACK);

export default function VersionControlPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
