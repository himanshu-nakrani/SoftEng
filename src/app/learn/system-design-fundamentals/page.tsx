import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "system-design-fundamentals";

export const metadata = trackMetadata(TRACK);

export default function SystemDesignFundamentalsPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
