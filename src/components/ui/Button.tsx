import { ButtonHTMLAttributes, forwardRef } from "react";
import classNames from "classnames";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "danger" | "success" | "outline" | "ghost";
	size?: "sm" | "md" | "lg";
	isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
		return (
			<button
				ref={ref}
				className={classNames(
					"inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
					{
						// Variants
						"bg-accent text-white hover:bg-accent-hover": variant === "primary",
						"bg-bg-tertiary text-text-primary hover:bg-bg-secondary hover:text-white border border-border": variant === "secondary",
						"bg-error text-white hover:bg-red-600": variant === "danger",
						"bg-success text-bg-tertiary hover:bg-green-400": variant === "success",
						"border border-border bg-transparent hover:bg-bg-tertiary text-text-primary": variant === "outline",
						"bg-transparent hover:bg-bg-tertiary text-text-muted hover:text-text-primary": variant === "ghost",

						// Sizes
						"h-8 px-3 text-xs": size === "sm",
						"h-10 px-4 py-2 text-sm": size === "md",
						"h-11 px-8 text-base": size === "lg",
					},
					className
				)}
				disabled={disabled || isLoading}
				{...props}
			>
				{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
				{children}
			</button>
		);
	}
);
Button.displayName = "Button";

export { Button };
