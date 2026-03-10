import Link from "next/link";
import { auth } from "@/auth";
import { LANDING_BACKGROUND_IMAGE_URL, LANDING_CONTENT } from "@/config/landing-content";
import LandingHeaderAuthActions from "@/components/landing/LandingHeaderAuthActions";
import LandingToastHandler from "@/components/landing/LandingToastHandler";

export const preferredRegion = "icn1";

function FeatureCard({
	title,
	description,
	enterLabel,
	href,
	toneClassName,
}: {
	title: string;
	description: string;
	enterLabel: string;
	href: string;
	toneClassName: string;
}) {
	return (
		<Link
			href={href}
			className="group relative overflow-hidden rounded-[28px] border border-white/12 bg-black/35 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-black/45"
		>
			<div className={`absolute inset-x-0 top-0 h-1 ${toneClassName}`} />
			<div className="relative flex min-h-[180px] flex-col justify-between gap-6">
				<div>
					<h2 className="text-2xl font-bold text-white">{title}</h2>
					<p className="mt-3 text-sm leading-6 text-white/72">{description}</p>
				</div>
				<div className="text-sm font-semibold text-white/90 transition-transform duration-300 group-hover:translate-x-1">
					{enterLabel}
				</div>
			</div>
		</Link>
	);
}

export default async function LandingPage() {
	const session = await auth();
	const isLoggedIn = Boolean(session?.user);
	const nickname = session?.user?.nickname ?? "게스트";

	return (
		<div className="relative min-h-screen w-full overflow-hidden bg-[#0d0f14] text-white">
			<LandingToastHandler />
			<div
				className="fixed inset-0 bg-cover bg-center bg-no-repeat saturate-[0.94]"
				style={{ backgroundImage: `url(${LANDING_BACKGROUND_IMAGE_URL})` }}
				aria-hidden
			/>
			<div
				className="fixed inset-0"
				style={{
					background:
						"linear-gradient(120deg, rgba(17,17,17,0.55) 0%, rgba(12,12,12,0.72) 55%, rgba(8,8,8,0.84) 100%)",
				}}
				aria-hidden
			/>

			<div className="relative flex min-h-screen w-full flex-col px-5 py-8 md:px-8 md:py-12">
				<header className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<div className="text-xs font-semibold uppercase tracking-[0.32em] text-white/55">{LANDING_CONTENT.brandEyebrow}</div>
						<div className="mt-2 text-2xl font-bold md:text-3xl">{LANDING_CONTENT.title}</div>
					</div>
					<div className="flex flex-wrap gap-2">
						{isLoggedIn ? (
							<LandingHeaderAuthActions nickname={nickname} greetingPrefix={LANDING_CONTENT.loggedInGreetingPrefix} />
						) : (
							<>
								<Link href="/login" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm text-white/85 transition-colors hover:bg-white/10">
									{LANDING_CONTENT.guestActions.login}
								</Link>
								<Link href="/register" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#111827] transition-colors hover:bg-white/90">
									{LANDING_CONTENT.guestActions.register}
								</Link>
							</>
						)}
					</div>
				</header>

				<section className="flex flex-1 items-center py-10 md:py-16">
					<div className="w-full rounded-[32px] border border-white/10 bg-black/28 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.42)] backdrop-blur-md md:p-8">
						<div className="mb-8 max-w-2xl">
							<p className="text-sm leading-7 text-white/72 md:text-base">
								{LANDING_CONTENT.description}
							</p>
						</div>

						<div className="grid gap-4 md:grid-cols-3">
							<FeatureCard
								title={LANDING_CONTENT.cards.develope.title}
								description={LANDING_CONTENT.cards.develope.description}
								enterLabel={LANDING_CONTENT.cards.develope.enterLabel}
								href="/develope"
								toneClassName="bg-[linear-gradient(90deg,rgba(129,140,248,0.95),rgba(59,130,246,0.8))]"
							/>
							<FeatureCard
								title={LANDING_CONTENT.cards.sinmungo.title}
								description={LANDING_CONTENT.cards.sinmungo.description}
								enterLabel={LANDING_CONTENT.cards.sinmungo.enterLabel}
								href="/sinmungo"
								toneClassName="bg-[linear-gradient(90deg,rgba(192,132,252,0.95),rgba(236,72,153,0.8))]"
							/>
							<FeatureCard
								title={LANDING_CONTENT.cards.profile.title}
								description={LANDING_CONTENT.cards.profile.description}
								enterLabel={LANDING_CONTENT.cards.profile.enterLabel}
								href={isLoggedIn ? "/profile" : "/login"}
								toneClassName="bg-[linear-gradient(90deg,rgba(74,222,128,0.95),rgba(34,197,94,0.8))]"
							/>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
