import { lessonOg } from "@/lib/og";

const og = lessonOg("inode");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
