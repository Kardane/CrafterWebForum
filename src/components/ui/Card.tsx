import { forwardRef, HTMLAttributes } from "react";
import classNames from "classnames";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
	({ className, hoverable, children, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={classNames(
					"bg-bg-secondary rounded-lg border border-bg-tertiary p-4",
					hoverable && "hover:border-border transition-colors duration-200 cursor-pointer",
					className
				)}
				{...props}
			>
				{children}
			</div>
		);
	}
);
Card.displayName = "Card";

export { Card };
