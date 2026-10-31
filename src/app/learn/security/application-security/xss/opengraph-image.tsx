import { lessonOg } from "@/lib/og";

const og = lessonOg("xss");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
