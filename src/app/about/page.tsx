import Link from "next/link";

export default function AboutPage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8">
			<div className="w-full max-w-3xl">
				<h1 className="text-3xl font-bold mb-6">Community Guidelines</h1>
				
				<div className="space-y-6 text-rich-brown">
					<section>
						<h2 className="text-xl font-semibold mb-3">Welcome to Project Library</h2>
						<p className="text-base leading-relaxed">
							Project Library is a platform dedicated to creativity, mutuality, and lifelong learning. 
							We believe in building a community where people can share their projects, learn from each other, 
							and connect through creative endeavors.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold mb-3">Our Values</h2>
						<ul className="list-disc list-inside space-y-2 text-base">
							<li><strong>Creativity:</strong> We celebrate all forms of creative expression and innovation.</li>
							<li><strong>Mutuality:</strong> We believe in mutual support, collaboration, and shared learning.</li>
							<li><strong>Lifelong Learning:</strong> We embrace continuous growth and skill development.</li>
							<li><strong>Respect:</strong> We treat all community members with kindness and respect.</li>
						</ul>
					</section>

					<section>
						<h2 className="text-xl font-semibold mb-3">Community Guidelines</h2>
						<div className="space-y-4">
							<div>
								<h3 className="font-semibold mb-2">Be Respectful</h3>
								<p className="text-sm text-warm-grey">
									Treat all community members with respect. Constructive feedback is welcome, 
									but personal attacks, harassment, or discriminatory language will not be tolerated.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2">Share Authentically</h3>
								<p className="text-sm text-warm-grey">
									Share your genuine projects, experiences, and knowledge. We value authenticity 
									and honesty in all contributions.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2">Support Others</h3>
								<p className="text-sm text-warm-grey">
									Encourage and support fellow creators. Offer helpful feedback, share resources, 
									and celebrate each other's achievements.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2">Respect Intellectual Property</h3>
								<p className="text-sm text-warm-grey">
									Only share content that you own or have permission to share. Give credit where 
									credit is due and respect others' intellectual property rights.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2">Keep It Safe</h3>
								<p className="text-sm text-warm-grey">
									Do not share personal information that could compromise your safety or the safety 
									of others. Report any concerning behavior to our moderation team.
								</p>
							</div>
						</div>
					</section>

					<section>
						<h2 className="text-xl font-semibold mb-3">What We Offer</h2>
						<ul className="list-disc list-inside space-y-2 text-base">
							<li><strong>Projects:</strong> Share your creative work and track your progress</li>
							<li><strong>Events:</strong> Create and discover creative and skill-building events</li>
							<li><strong>Tool Lending:</strong> Connect with others to share tools and resources</li>
							<li><strong>Mentorship:</strong> Find experts and build teaching and learning connections</li>
							<li><strong>Work Trades:</strong> Exchange skills and services within the community</li>
						</ul>
					</section>

					<section>
						<h2 className="text-xl font-semibold mb-3">Get Involved</h2>
						<p className="text-base leading-relaxed">
							We're always looking to improve and grow our community. If you have feedback, suggestions, 
							or want to report an issue, please use our{" "}
							<a href="https://forms.google.com" target="_blank" rel="noopener noreferrer" className="underline">
								feedback survey
							</a>{" "}
							or{" "}
							<a href="https://forms.google.com" target="_blank" rel="noopener noreferrer" className="underline">
								bug report form
							</a>.
						</p>
					</section>

					<div className="mt-8 pt-6 border-t border-soft-grey">
						<Link href="/" className="text-sm underline">Back to Home</Link>
					</div>
				</div>
			</div>
		</main>
	);
}

