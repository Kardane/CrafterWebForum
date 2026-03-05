import type { ReactNode } from "react";
import Image from "next/image";
import classNames from "classnames";
import authBackgroundImage from "../../../public/img/background.png";
import authLogoImage from "../../../public/img/Crafter.png";
import styles from "./AuthShell.module.css";

interface AuthShellProps {
	title: ReactNode;
	subtitle?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	align?: "left" | "center";
	logoSize?: number;
	backgroundImageUrl?: string;
}

export default function AuthShell({
	title,
	subtitle,
	children,
	footer,
	align = "left",
	logoSize = 80,
	backgroundImageUrl,
}: AuthShellProps) {
	return (
		<div className={classNames(styles.container, align === "left" ? styles.alignLeft : styles.alignCenter)}>
			{backgroundImageUrl ? (
				<div className={styles.background} style={{ backgroundImage: `url(${backgroundImageUrl})` }} aria-hidden />
			) : (
				<Image
					src={authBackgroundImage}
					alt=""
					fill
					priority
					sizes="100vw"
					quality={62}
					placeholder="blur"
					className={styles.background}
				/>
			)}
			<div className={styles.backgroundOverlay} aria-hidden />

			<div className={styles.card}>
				<div className={styles.header}>
						<Image
							src={authLogoImage}
							alt="Crafter Forum"
							width={logoSize}
							height={logoSize}
							className={styles.logo}
						/>
					<h1 className={styles.title}>{title}</h1>
					{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
				</div>

				<div className={styles.content}>{children}</div>

				{footer && <div className={styles.footer}>{footer}</div>}
			</div>
		</div>
	);
}
