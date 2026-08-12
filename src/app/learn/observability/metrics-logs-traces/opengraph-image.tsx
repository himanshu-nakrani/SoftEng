import { lessonOg } from "@/lib/og";

const og = lessonOg("metrics-logs-traces");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
