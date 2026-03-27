"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogoutIcon, LoginIcon } from "@/lib/components/icons/icons";
import { COLLECTIONS, LOGIN } from "@/lib/const/routes";

interface LoginLogoutIconProps {
	isLoggedIn: boolean;
	iconStyles?: string;
	iconButtonStyles?: string;
}

export function LoginLogoutIcon({ isLoggedIn, iconStyles, iconButtonStyles }: LoginLogoutIconProps) {
	const router = useRouter();

	const handleLogout = async () => {
		await signOut({ callbackUrl: COLLECTIONS });
	};

	const handleLogin = () => {
		router.push(LOGIN);
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

