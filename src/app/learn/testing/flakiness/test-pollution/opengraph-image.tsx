import { lessonOg } from "@/lib/og";

const og = lessonOg("test-pollution");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
