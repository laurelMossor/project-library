import { redirect } from "next/navigation";
import { COLLECTIONS } from "@/lib/const/routes";
// import 'bootstrap/dist/css/bootstrap.min.css';

export default function Home() {
	redirect(COLLECTIONS);
}
