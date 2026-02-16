import { redirect } from "next/navigation";

export default function GuestsRedirect() {
  redirect("/kontrahenci?tab=goscie");
}
