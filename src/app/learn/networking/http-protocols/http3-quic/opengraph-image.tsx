import { lessonOg } from "@/lib/og";

const og = lessonOg("http3-quic");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
