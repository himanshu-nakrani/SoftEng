import { lessonOg } from "@/lib/og";

const og = lessonOg("blue-green");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
