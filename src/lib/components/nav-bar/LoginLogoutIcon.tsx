"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogoutIcon, LoginIcon } from "@/lib/components/icons/icons";

interface LoginLogoutIconProps {
	isLoggedIn: boolean;
}

const iconButtonStyles = "p-2 hover:bg-soft-grey rounded transition-colors";

export function LoginLogoutIcon({ isLoggedIn }: LoginLogoutIconProps) {
	const router = useRouter();

	const handleLogout = async () => {
		await signOut({ callbackUrl: "/collections" });
	};

	const handleLogin = () => {
		router.push("/login");
	};

	return isLoggedIn ? (
		<button
			onClick={handleLogout}
			className={iconButtonStyles}
			aria-label="Log Out"
			title="Log Out"
		>
			<LogoutIcon />
		</button>
	) : (
		<button
			onClick={handleLogin}
			className={iconButtonStyles}
			aria-label="Log In"
			title="Log In"
		>
			<LoginIcon />
		</button>
	);
}

