import { redirect } from "next/navigation";

export default function LegacyTournamentsRedirect() {
  redirect("/servers");
}
