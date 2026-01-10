/**
 * PRIVATE ORG PROFILE / SETTINGS PAGE
 * 
 * This is the org's private profile settings page at /profile/org/[slug].
 * - Protected route (requires authentication and org membership)
 * - Used for editing org profile information and settings
 * - Does NOT display collections (projects/events)
 * - Provides quick actions and links to other pages
 * 
 * For the public profile view with collections, see: /o/[slug]
 */
import { auth } from "@/lib/auth";
import { getOrgBySlug, getUserOrgRole } from "@/lib/utils/server/org";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { LOGIN_WITH_CALLBACK, PRIVATE_USER_PAGE, PUBLIC_ORG_PAGE, PROJECT_NEW, EVENT_NEW, HOME, COLLECTIONS } from "@/lib/const/routes";
import { ActorProfileDisplay } from "@/lib/components/actor/ActorProfileDisplay";
import { Actor } from "@/lib/types/actor";

type Props = {
	params: Promise<{ slug: string }>;
};

export default async function OrgProfilePage({ params }: Props) {
	const session = await auth();

	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
	}

	const { slug } = await params;
	const org = await getOrgBySlug(slug);

	if (!org) {
		notFound();
	}

	// Check if user is a member with appropriate role
	const role = await getUserOrgRole(session.user.id, org.id);
	if (!role || role === "FOLLOWER") {
		// User is not a member or only a follower, redirect to public profile
		redirect(PUBLIC_ORG_PAGE(slug));
	}

	// Create Actor type for the org
	const actor: Actor = { type: "ORG", data: org };

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2">Org Profile Settings</h1>
				<p className="text-gray-600">Manage {org.name}'s profile information and settings</p>
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Profile Information</h2>
				<ActorProfileDisplay actor={actor} />
				{/* TODO: Add EditableOrgProfile component similar to EditableProfile */}
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
				<div className="flex flex-col gap-3">
					<ButtonLink href={PUBLIC_ORG_PAGE(slug)} variant="secondary" fullWidth>
						View Public Profile
					</ButtonLink>
					<ButtonLink href={PROJECT_NEW} variant="secondary" fullWidth>
						Create New Project
					</ButtonLink>
					<ButtonLink href={EVENT_NEW} variant="secondary" fullWidth>
						Create New Event
					</ButtonLink>
					<ButtonLink href={PRIVATE_USER_PAGE} variant="secondary" fullWidth>
						Switch to User Profile
					</ButtonLink>
				</div>
			</div>

			<div className="flex gap-4 justify-center">
				<Link href={HOME} className="text-sm underline text-gray-600">Home</Link>
				<Link href={COLLECTIONS} className="text-sm underline text-gray-600">Collections</Link>
			</div>
		</CenteredLayout>
	);
}

