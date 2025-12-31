"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogoutIcon, LoginIcon } from "@/lib/components/icons/icons";

interface LoginLogoutIconProps {
	isLoggedIn: boolean;
	iconStyles?: string;
	iconButtonStyles?: string;
}

const iconButtonStyles = "p-2 hover:bg-soft-grey rounded transition-colors";

export function LoginLogoutIcon({ isLoggedIn, iconStyles, iconButtonStyles }: LoginLogoutIconProps) {
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
			<LogoutIcon className={iconStyles} />
		</button>
	) : (
		<button
			onClick={handleLogin}
			className={iconButtonStyles}
			aria-label="Log In"
			title="Log In"
		>
			<LoginIcon className={iconStyles} />
		</button>
	);
}

