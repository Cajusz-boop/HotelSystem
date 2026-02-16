import { redirect } from "next/navigation";

export default function FirmyRedirect() {
  redirect("/kontrahenci?tab=firmy");
}
