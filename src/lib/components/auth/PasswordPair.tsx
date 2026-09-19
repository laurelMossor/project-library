"use client";

import { FormInput } from "@/lib/components/forms/FormInput";

type PasswordPairProps = {
	password: string;
	confirm: string;
	onPasswordChange: (value: string) => void;
	onConfirmChange: (value: string) => void;
	passwordPlaceholder?: string;
	confirmPlaceholder?: string;
};

/**
 * Two password fields for set/reset (signup, reset-password).
 * autocomplete=new-password so password managers treat this as creating a password.
 */
export function PasswordPair({
	password,
	confirm,
	onPasswordChange,
	onConfirmChange,
	passwordPlaceholder = "Password",
	confirmPlaceholder = "Confirm password",
}: PasswordPairProps) {
	return (
		<>
			<FormInput
				type="password"
				placeholder={passwordPlaceholder}
				value={password}
				onChange={(e) => onPasswordChange(e.target.value)}
				autoComplete="new-password"
				required
			/>
			<FormInput
				type="password"
				placeholder={confirmPlaceholder}
				value={confirm}
				onChange={(e) => onConfirmChange(e.target.value)}
				autoComplete="new-password"
				required
			/>
		</>
	);
}
