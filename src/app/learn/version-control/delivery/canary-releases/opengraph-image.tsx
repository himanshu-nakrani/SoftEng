import { lessonOg } from "@/lib/og";

const og = lessonOg("canary-releases");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
