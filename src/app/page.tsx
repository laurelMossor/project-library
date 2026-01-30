import { redirect } from "next/navigation";
import { WELCOME_PAGE } from "@/lib/const/routes";
// import 'bootstrap/dist/css/bootstrap.min.css';

export default function Home() {
	redirect(WELCOME_PAGE);
}
