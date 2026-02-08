import { InputHTMLAttributes, forwardRef } from "react";
import classNames from "classnames";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, label, error, ...props }, ref) => {
		return (
			<div className="w-full">
				{label && (
					<label className="block text-sm font-medium text-text-muted mb-1.5">
						{label}
					</label>
				)}
				<div className="relative">
					<input
						ref={ref}
						className={classNames(
							"flex h-10 w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
							error ? "border-error focus:ring-error" : "border-border",
							className
						)}
						{...props}
					/>
				</div>
				{error && <p className="mt-1 text-xs text-error">{error}</p>}
			</div>
		);
	}
);
Input.displayName = "Input";

export { Input };
