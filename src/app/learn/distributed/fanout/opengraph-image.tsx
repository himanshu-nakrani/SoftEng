import { lessonOg } from "@/lib/og";

const og = lessonOg("fanout");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
